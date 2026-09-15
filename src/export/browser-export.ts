import { takeContainerSnapshot } from '../sandbox/snapshot';
import { logger } from '../core/logger';
import {
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  CanvasSource,
} from 'mediabunny';

export interface ExportProgress {
  frame: number;
  totalFrames: number;
  progress: number;
  phase: 'capturing' | 'encoding' | 'muxing' | 'done';
}

export type BrowserExportCodec = 'avc' | 'vp8' | 'vp9';
export type ExportQuality = 'low' | 'medium' | 'high';

const QUALITY_BPP: Record<ExportQuality, number> = {
  low: 0.05,
  medium: 0.15,
  high: 0.3,
};

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
  container: HTMLElement;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  seekTo: (frame: number) => void;
  waitRender?: () => Promise<void>;
  codec?: BrowserExportCodec;
  quality?: ExportQuality;
  bitrate?: number;
  frameDelayMs?: number;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

export function assertWebCodecs(): void {
  if (typeof (globalThis as any).VideoEncoder === 'undefined') {
    throw new Error('Ваш браузер не поддерживает WebCodecs API (VideoEncoder).');
  }
}

export function toEvenFrameSize(value: number): number {
  return Math.max(2, value - (value % 2));
}

// Заставляем пайплайн дождаться, пока все видео-элементы декодируют нужный кадр после seek.
// Это решает проблему "рывков" в B-roll (OffthreadVideo).
function waitForMediaElements(container: HTMLElement): Promise<void[]> {
  const mediaElements = Array.from(container.querySelectorAll('video'));

  return Promise.all(
    mediaElements.map((media) => {
      // Если видео уже готово и не находится в процессе поиска кадра
      if (media.readyState >= 2 && !media.seeking) return Promise.resolve();

      return new Promise<void>((resolve) => {
        const listener = () => {
          media.removeEventListener('seeked', listener);
          media.removeEventListener('canplay', listener);
          resolve();
        };
        media.addEventListener('seeked', listener);
        media.addEventListener('canplay', listener);

        // Фолбэк таймаут, чтобы не повесить рендер навсегда, если видео битое
        setTimeout(() => {
          media.removeEventListener('seeked', listener);
          media.removeEventListener('canplay', listener);
          resolve();
        }, 300);
      });
    })
  );
}

function defaultWaitRender(frameDelayMs: number): () => Promise<void> {
  return async () => {
    if (typeof requestAnimationFrame === 'function') {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    }
    if (frameDelayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, frameDelayMs));
    }
  };
}

async function drawDataUrlToCanvas(
  dataUrl: string,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<void> {
  // Отключаем альфа-канал на уровне контекста для максимальной скорости H.264
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
  if (!ctx) throw new Error('Не удалось получить 2D-контекст canvas для экспорта.');

  // Использование createImageBitmap переносит декодирование JPEG/PNG с главного потока
  // на воркеры браузера/GPU, что кардинально ускоряет рендер по сравнению с new Image().
  if (typeof createImageBitmap !== 'undefined') {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      return;
    } catch (e) {
      logger.warn('createImageBitmap failed, falling back to new Image()', e);
    }
  }

  // Fallback для старых браузеров
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
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
    frameDelayMs = 0, // Убираем задержку, так как мы теперь жестко ждем готовности тегов <video>
    onProgress,
    signal,
  } = options;

  if (durationInFrames <= 0 || fps <= 0) {
    throw new Error('Export: durationInFrames и fps должны быть положительными.');
  }

  if (signal?.aborted) {
    throw new DOMException('Export aborted', 'AbortError');
  }

  const normalizedWidth = toEvenFrameSize(width);
  const normalizedHeight = toEvenFrameSize(height);
  const bitrate = options.bitrate ?? calculateBitrate(width, height, fps, quality);
  const waitRender = options.waitRender ?? defaultWaitRender(frameDelayMs);

  logger.info('Экспорт видео: старт пайплайна (Mediabunny / Sync Video)', {
    width: normalizedWidth,
    height: normalizedHeight,
    fps,
    codec,
    quality,
    bitrate,
    frames: durationInFrames,
  });

  const canvas = document.createElement('canvas');
  canvas.width = normalizedWidth;
  canvas.height = normalizedHeight;

  const isMp4 = codec === 'avc';

  const output = new Output({
    format: isMp4 ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(canvas, {
    codec: isMp4 ? 'avc' : codec,
    bitrate,
  });

  output.addVideoTrack(videoSource);
  await output.start();

  try {
    for (let frame = 0; frame < durationInFrames; frame++) {
      if (signal?.aborted) throw new DOMException('Export aborted', 'AbortError');

      // 1. Перемещаем таймлайн
      seekTo(frame);

      // 2. Ждем, пока DOM обновится
      await waitRender();

      // 3. ЖДЕМ ГОТОВНОСТИ ВИДЕО (исправляет рывки B-Roll)
      await waitForMediaElements(container);

      // 4. Снимаем DOM в Data URL (JPEG - самый быстрый формат)
      const dataUrl = await takeContainerSnapshot(container, {
        format: 'image/jpeg',
        quality: 1.0,
        targetWidth: normalizedWidth,
        targetHeight: normalizedHeight,
      });

      // 5. Отрисовываем аппаратно
      await drawDataUrlToCanvas(dataUrl, canvas, normalizedWidth, normalizedHeight);

      // 6. Отправляем в энкодер WebCodecs
      const timestampSec = frame / fps;
      const durationSec = 1 / fps;
      await videoSource.add(timestampSec, durationSec);

      onProgress?.({
        frame,
        totalFrames: durationInFrames,
        progress: (frame + 1) / durationInFrames,
        phase: 'capturing',
      });
    }

    onProgress?.({
      frame: durationInFrames,
      totalFrames: durationInFrames,
      progress: 1,
      phase: 'encoding',
    });

    videoSource.close();
    await output.finalize();

    onProgress?.({
      frame: durationInFrames,
      totalFrames: durationInFrames,
      progress: 1,
      phase: 'done',
    });

    const buffer = (output.target as BufferTarget).buffer as ArrayBuffer;
    const resultBlob = new Blob([buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });

    logger.info('Экспорт успешно завершён', {
      size: resultBlob.size,
      mimeType: resultBlob.type,
    });

    return resultBlob;
  } catch (error) {
    try {
      videoSource.close();
    } catch {}
    throw error;
  }
}

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

export function supportsBrowserExport(): boolean {
  return typeof (globalThis as any).VideoEncoder !== 'undefined';
}