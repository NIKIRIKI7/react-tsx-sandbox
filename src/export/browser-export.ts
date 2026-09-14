import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  type VideoCodec,
} from 'mediabunny';
import { takeContainerSnapshot } from '../sandbox/snapshot';

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
  /** Битрейт видео в битах/с. По умолчанию 5_000_000. */
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
    bitrate = 5_000_000,
    frameDelayMs = 24,
    onProgress,
    signal,
  } = options;

  if (durationInFrames <= 0 || fps <= 0) {
    throw new Error('Export: durationInFrames и fps должны быть положительными.');
  }

  const waitRender = options.waitRender ?? defaultWaitRender(frameDelayMs);

  if (signal?.aborted) {
    throw new DOMException('Export aborted', 'AbortError');
  }

  const videoCodec: VideoCodec = codec;
  const format = codec === 'avc' ? new Mp4OutputFormat() : new WebMOutputFormat();
  const target = new BufferTarget();
  const output = new Output({ format, target });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

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

      const dataUrl = await takeContainerSnapshot(container, { format: 'image/png', scale: 1 });
      await drawDataUrlToCanvas(dataUrl, canvas, width, height);

      await videoSource.add(frame * secondsPerFrame, secondsPerFrame);

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