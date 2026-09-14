import { takeContainerSnapshot } from '../sandbox/snapshot';
import { logger } from '../core/logger';
import { IsobmffMuxer } from './muxers/isobmff-muxer';
import { EbmlMuxer } from './muxers/ebml-muxer';

/**
 * Zero-Backend экспорт видео: покадровый захват контейнера плеера
 * и кодирование через WebCodecs (`VideoEncoder`). Мультиплексирование
 * выполняют встроенные лёгкие муксеры (ISO-BMFF / EBML) — без сторонних
 * зависимостей.
 *
 * Работает только в браузерах с `VideoEncoder` (Chrome, Edge, Firefox 130+,
 * Safari 16.4+). Вернуть `Blob` можно скачать через `downloadExportBlob`.
 */

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
  medium: 0.1,
  high: 0.2,
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

function assertWebCodecs(): void {
  if (typeof (globalThis as any).VideoEncoder === 'undefined') {
    throw new Error('Ваш браузер не поддерживает WebCodecs API (VideoEncoder).');
  }
}

export function toEvenFrameSize(value: number): number {
  return Math.max(2, value - (value % 2));
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

function resolveCodecString(codec: BrowserExportCodec, width: number, height: number): string {
  if (codec === 'vp8') return 'vp8';
  if (codec === 'vp9') return 'vp09.00.41.08';

  const pixels = width * height;
  if (pixels <= 1280 * 720) return 'avc1.42001f';
  if (pixels <= 1920 * 1080) return 'avc1.4d002a';
  return 'avc1.640033';
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
    frameDelayMs = 24,
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

  logger.info('Экспорт видео: старт автономного пайплайна', {
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
  const mp4Muxer = isMp4
    ? new IsobmffMuxer({ width: normalizedWidth, height: normalizedHeight, fps })
    : null;
  const webmMuxer = !isMp4
    ? new EbmlMuxer({ width: normalizedWidth, height: normalizedHeight, fps, codec })
    : null;

  const microsecondsPerFrame = Math.round(1_000_000 / fps);

  let encoderError: Error | null = null;

  const encoder = new (globalThis as any).VideoEncoder({
    output: (chunk: any, metadata?: any) => {
      const chunkData = new Uint8Array(chunk.byteLength);
      chunk.copyTo(chunkData);

      const isKeyframe = chunk.type === 'key';
      const timestampSec = chunk.timestamp / 1_000_000;

      if (isMp4 && mp4Muxer) {
        if (metadata?.decoderConfig?.description) {
          const desc = new Uint8Array(metadata.decoderConfig.description);
          mp4Muxer.setDecoderDescription(desc);
        }
        mp4Muxer.addSample(chunkData, isKeyframe, 1 / fps);
      } else if (webmMuxer) {
        webmMuxer.addSample(chunkData, isKeyframe, timestampSec);
      }
    },
    error: (err: any) => {
      encoderError = err instanceof Error ? err : new Error(String(err));
      logger.error('Ошибка WebCodecs VideoEncoder', err);
    },
  });

  const codecString = resolveCodecString(codec, normalizedWidth, normalizedHeight);
  encoder.configure({
    codec: codecString,
    width: normalizedWidth,
    height: normalizedHeight,
    bitrate,
    framerate: fps,
    hardwareAcceleration: 'no-preference',
    avc: isMp4 ? { format: 'avc' } : undefined,
  });

  const keyFrameInterval = Math.max(1, Math.round(fps * 2));

  try {
    for (let frame = 0; frame < durationInFrames; frame++) {
      if (signal?.aborted) throw new DOMException('Export aborted', 'AbortError');
      if (encoderError) throw encoderError;

      seekTo(frame);
      await waitRender();

      const dataUrl = await takeContainerSnapshot(container, {
        format: 'image/png',
        targetWidth: width,
        targetHeight: height,
      });
      await drawDataUrlToCanvas(dataUrl, canvas, normalizedWidth, normalizedHeight);

      const videoFrame = new (globalThis as any).VideoFrame(canvas, {
        timestamp: frame * microsecondsPerFrame,
        duration: microsecondsPerFrame,
      });

      encoder.encode(videoFrame, { keyFrame: frame % keyFrameInterval === 0 });
      videoFrame.close();

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

    await encoder.flush();
    encoder.close();

    if (encoderError) throw encoderError;

    onProgress?.({
      frame: durationInFrames,
      totalFrames: durationInFrames,
      progress: 1,
      phase: 'muxing',
    });

    const resultBlob = isMp4 ? mp4Muxer!.finalize() : webmMuxer!.finalize();

    onProgress?.({
      frame: durationInFrames,
      totalFrames: durationInFrames,
      progress: 1,
      phase: 'done',
    });

    logger.info('Экспорт успешно завершён', {
      size: resultBlob.size,
      mimeType: resultBlob.type,
    });

    return resultBlob;
  } catch (error) {
    try {
      if (encoder.state !== 'closed') encoder.close();
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
