import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  type VideoCodec,
} from 'mediabunny';
import { takeContainerSnapshot } from '../sandbox/snapshot';
import { logger } from '../core/logger';

/**
 * Zero-Backend экспорт видео: покадровый захват контейнера плеера
 * и кодирование через WebCodecs (`VideoEncoder`). Мультиплексирование
 * выполняет `mediabunny` — надёжный MP4 (H.264) и WebM (VP8/VP9).
 *
 * Работает только в браузерах с `VideoEncoder` (Chrome, Edge, Firefox 130+,
 * Safari 17.4+). Вернуть `Blob` можно скачать через `downloadExportBlob`.
 */

export interface ExportProgress {
  frame: number;
  totalFrames: number;
  progress: number;
  phase: 'capturing' | 'encoding' | 'muxing' | 'done';
}

export type BrowserExportCodec = 'avc' | 'vp8' | 'vp9';

/** Пресеты качества по битам на пиксель (BPP) на каждый кадр. */
export type ExportQuality = 'low' | 'medium' | 'high';

const QUALITY_BPP: Record<ExportQuality, number> = {
  low: 0.05,
  medium: 0.1,
  high: 0.2,
};

/**
 * Считает целевой битрейт из разрешения/частоты кадров и пресета качества.
 * Пример: 1080×1920 @ 30fps → 62 208 000 px/s; high (×0.2) ≈ 12,4 Мбит/с.
 */
export function calculateBitrate(
  width: number,
  height: number,
  fps: number,
  quality: ExportQuality,
): number {
  const pixelsPerSecond = width * height * fps;
  return Math.round(pixelsPerSecond * QUALITY_BPP[quality]);
}

export interface BrowserExportOptions {
  /** DOM-контейнер с игровым кадром (обычно `PlayerSandbox` `containerRef`). */
  container: HTMLElement;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  /** Переведение плеера в нужный кадр. */
  seekTo: (frame: number) => void;
  /** Ожидание отрисовки кадра (по умолчанию два rAF + `frameDelayMs`). */
  waitRender?: () => Promise<void>;
  /** `avc` — MP4 (H.264, по умолчанию), `vp8`/`vp9` — WebM. */
  codec?: BrowserExportCodec;
  /** Пресет качества. По умолчанию `'high'`. */
  quality?: ExportQuality;
  /** Битрейт видео в битах/с; приоритетнее `quality`. */
  bitrate?: number;
  frameDelayMs?: number;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

function assertWebCodecs(): void {
  if (typeof (globalThis as any).VideoEncoder === 'undefined') {
    throw new Error('Ваш браузер не поддерживает WebCodecs API (VideoEncoder).');
  }
}

/**
 * MP4 (H.264) через WebCodecs требует чётных размеров кадра — округляем
 * в меньшую сторону до ближайшего чётного, но не меньше 2.
 */
export function toEvenFrameSize(value: number): number {
  return Math.max(2, value - (value % 2));
}

function defaultWaitRender(frameDelayMs: number): () => Promise<void> {
  return async () => {
    if (typeof requestAnimationFrame === 'function') {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    if (frameDelayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, frameDelayMs));
  };
}

/** Декодирует data-URL кадра и рисует его в canvas, из которого читает `CanvasSource`. */
function drawDataUrlToCanvas(
  dataUrl: string,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Не удалось получить 2D-контекст canvas для экспорта.');
        ctx.drawImage(image, 0, 0, width, height);
        resolve();
      } catch (error) {
        reject(error as Error);
      }
    };
    image.onerror = () => reject(new Error('Не удалось декодировать кадр для экспорта.'));
    image.src = dataUrl;
  });
}

/**
 * Рендерит плеер в `.mp4`/`.webm` прямо в браузере.
 *
 * Возвращает `Blob` готового видео. Дальше его можно скачать
 * `downloadExportBlob(blob)` или использовать как угодно (ObjectURL, fetch...).
 */
export async function exportBrowserVideo(options: BrowserExportOptions): Promise<Blob> {
  assertWebCodecs();

  const {
    container,
    durationInFrames,
    fps,
    width,
    height,
    seekTo,
    codec = 'avc',
    quality = 'high',
    frameDelayMs = 24,
    onProgress,
    signal,
  } = options;

  if (durationInFrames <= 0 || fps <= 0) {
    throw new Error('Export: durationInFrames и fps должны быть положительными.');
  }

  logger.info('Экспорт видео: настройки', {
    width,
    height,
    fps,
    codec,
    quality,
    bitrate: options.bitrate ?? calculateBitrate(width, height, fps, quality),
    frames: durationInFrames,
  });

  // H.264/AVC требует чётных размеров кадра — округляем в меньшую сторону.
  const normalizedWidth = toEvenFrameSize(width);
  const normalizedHeight = toEvenFrameSize(height);

  // Целевой битрейт: явный `bitrate` важнее пресета качества.
  const bitrate = options.bitrate ?? calculateBitrate(width, height, fps, quality);

  const waitRender = options.waitRender ?? defaultWaitRender(frameDelayMs);

  if (signal?.aborted) {
    throw new DOMException('Export aborted', 'AbortError');
  }

  const videoCodec: VideoCodec = codec;
  const format = codec === 'avc' ? new Mp4OutputFormat() : new WebMOutputFormat();
  const target = new BufferTarget();
  const output = new Output({ format, target });

  const canvas = document.createElement('canvas');
  canvas.width = normalizedWidth;
  canvas.height = normalizedHeight;

  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    bitrate,
    keyFrameInterval: Math.max(1, Math.round(fps * 2)),
  });
  output.addVideoTrack(videoSource);

  const secondsPerFrame = 1 / fps;

  try {
    await output.start();

    for (let frame = 0; frame < durationInFrames; frame++) {
      if (signal?.aborted) throw new DOMException('Export aborted', 'AbortError');

      seekTo(frame);
      await waitRender();

      const dataUrl = await takeContainerSnapshot(container, {
        format: 'image/png',
        targetWidth: width,
        targetHeight: height,
      });
      await drawDataUrlToCanvas(dataUrl, canvas, normalizedWidth, normalizedHeight);

      await videoSource.add(frame * secondsPerFrame, secondsPerFrame);

      if (frame % 25 === 0) {
        logger.debug('Экспорт: кадр', { frame, total: durationInFrames });
      }

      onProgress?.({
        frame,
        totalFrames: durationInFrames,
        progress: (frame + 1) / durationInFrames,
        phase: 'capturing',
      });
    }

    onProgress?.({ frame: durationInFrames, totalFrames: durationInFrames, progress: 1, phase: 'muxing' });
    await output.finalize();
  } catch (error) {
    try {
      await output.cancel();
    } catch {
      // Ошибка отмены не критична — главную ошибку пробрасываем дальше.
    }
    throw error;
  }

  const buffer = target.buffer ?? new ArrayBuffer(0);
  const blob = new Blob([buffer], { type: format.mimeType });
  onProgress?.({ frame: durationInFrames, totalFrames: durationInFrames, progress: 1, phase: 'done' });
  return blob;
}

/** Скачивает полученный Blob как файл; расширение подставляется по типу. */
export function downloadExportBlob(blob: Blob, filename?: string): void {
  const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
  const name = filename ?? `sandbox-export-${Date.now()}.${ext}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Проверка поддержки WebCodecs экспорта в текущем браузере. */
export function supportsBrowserExport(): boolean {
  return typeof (globalThis as any).VideoEncoder !== 'undefined';
}