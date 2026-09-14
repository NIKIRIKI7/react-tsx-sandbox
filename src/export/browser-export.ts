import { takeContainerSnapshot } from '../sandbox/snapshot';

/**
 * Zero-Backend экспорт видео: покадровый захват контейнера плеера,
 * аппаратное кодирование через WebCodecs (`VideoEncoder`) и сведение
 * в `.webm` собственным минимальным WebM/EBML-мультиплексором.
 *
 * Работает только в браузерах с `VideoEncoder`/`VideoFrame` (Chrome, Edge,
 * Firefox 130+, Safari 17+.4+). Вернуть `Blob` можно скачать через
 * `downloadExportBlob`.
 */

export interface ExportProgress {
  frame: number;
  totalFrames: number;
  progress: number;
  phase: 'capturing' | 'encoding' | 'muxing' | 'done';
}

export type BrowserExportCodec = 'vp8' | 'vp9';

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
  /** VP8 дешевле и поддерживается шире, VP9 лучше качество. */
  codec?: BrowserExportCodec;
  /** Битрейт видео в битах/с. По умолчанию 5_000_000. */
  bitrate?: number;
  frameDelayMs?: number;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

function assertWebCodecs(): void {
  const missing: string[] = [];
  if (typeof (globalThis as any).VideoEncoder === 'undefined') missing.push('VideoEncoder');
  if (typeof (globalThis as any).VideoFrame === 'undefined') missing.push('VideoFrame');
  if (missing.length > 0) {
    throw new Error(
      `Browser export недоступен: нет поддержки WebCodecs (${missing.join(', ')}). ` +
        'Используйте Chrome/Edge 94+, Firefox 130+ или Safari 17.4+.',
    );
  }
}

function float64(value: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value);
  return new Uint8Array(buffer);
}

function uint16(value: number): Uint8Array {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setUint16(0, value);
  return new Uint8Array(buffer);
}

/** Кодирует EBML vint (идентификаторы и размеры). */
function vint(value: number | bigint): Uint8Array {
  let v = typeof value === 'bigint' ? value : BigInt(value);
  for (let len = 1; len <= 8; len++) {
    const maxVal = (1n << BigInt(7 * len)) - 2n;
    if (v <= maxVal) {
      const out = new Uint8Array(len);
      let remaining = v;
      for (let i = len - 1; i >= 1; i--) {
        out[i] = Number(remaining & 0xffn);
        remaining >>= 8n;
      }
      out[0] = Number(remaining) | (1 << (8 - len));
      return out;
    }
  }
  throw new Error('WebM: значение слишком велико для EBML vint.');
}

function element(id: Uint8Array, body: Uint8Array | Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = Array.isArray(body) ? body : [body];
  const bodyLength = parts.reduce((sum, part) => sum + part.length, 0);
  const size = vint(BigInt(bodyLength));
  const out = new Uint8Array(id.length + size.length + bodyLength);
  let offset = 0;
  out.set(id, offset);
  offset += id.length;
  out.set(size, offset);
  offset += size.length;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function string(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

// EBML-идентификаторы (фиксированные байтовые последовательности).
const ID_EBML = Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3);
const ID_EBML_VERSION = Uint8Array.of(0x42, 0x86);
const ID_EBML_READ_VERSION = Uint8Array.of(0x42, 0xf7);
const ID_EBML_MAX_ID_LENGTH = Uint8Array.of(0x42, 0xf2);
const ID_EBML_MAX_SIZE_LENGTH = Uint8Array.of(0x42, 0xf3);
const ID_DOCTYPE = Uint8Array.of(0x42, 0x82);
const ID_DOCTYPE_VERSION = Uint8Array.of(0x42, 0x87);
const ID_DOCTYPE_READ_VERSION = Uint8Array.of(0x42, 0x85);
const ID_SEGMENT = Uint8Array.of(0x18, 0x53, 0x80, 0x67);
const ID_INFO = Uint8Array.of(0x15, 0x49, 0xa9, 0x66);
const ID_TIMECODE_SCALE = Uint8Array.of(0x2a, 0xd7, 0xb1);
const ID_DURATION = Uint8Array.of(0x44, 0x89);
const ID_MUXING_APP = Uint8Array.of(0x4d, 0x80);
const ID_WRITING_APP = Uint8Array.of(0x57, 0x41);
const ID_TRACKS = Uint8Array.of(0x16, 0x54, 0xae, 0x6b);
const ID_TRACK_ENTRY = Uint8Array.of(0xae);
const ID_TRACK_NUMBER = Uint8Array.of(0xd7);
const ID_TRACK_UID = Uint8Array.of(0x73, 0xc5);
const ID_TRACK_TYPE = Uint8Array.of(0x83);
const ID_CODEC_ID = Uint8Array.of(0x86);
const ID_VIDEO = Uint8Array.of(0xe0);
const ID_PIXEL_WIDTH = Uint8Array.of(0xb0);
const ID_PIXEL_HEIGHT = Uint8Array.of(0xba);
const ID_CLUSTER = Uint8Array.of(0x1f, 0x43, 0xb6, 0x75);
const ID_CLUSTER_TIMECODE = Uint8Array.of(0xe7);
const ID_SIMPLE_BLOCK = Uint8Array.of(0xa3);

interface MuxFrame {
  data: Uint8Array;
  timestampMs: number;
  keyframe: boolean;
}

interface WebmMuxerOptions {
  codecId: 'V_VP8' | 'V_VP9';
  width: number;
  height: number;
  fps: number;
  frames: MuxFrame[];
}

/** Минимальный WebM/EBML-мультиплексор (видео, без звука). */
export function muxWebm({ codecId, width, height, fps, frames }: WebmMuxerOptions): Blob {
  const ebmlHeader = element(
    ID_EBML,
    [
      element(ID_EBML_VERSION, Uint8Array.of(1)),
      element(ID_EBML_READ_VERSION, Uint8Array.of(1)),
      element(ID_EBML_MAX_ID_LENGTH, Uint8Array.of(4)),
      element(ID_EBML_MAX_SIZE_LENGTH, Uint8Array.of(8)),
      element(ID_DOCTYPE, string('webm')),
      element(ID_DOCTYPE_VERSION, Uint8Array.of(4)),
      element(ID_DOCTYPE_READ_VERSION, Uint8Array.of(2)),
    ],
  );

  const durationMs = frames.length > 0 ? (frames[frames.length - 1].timestampMs + 1000 / fps) : 0;

  const info = element(
    ID_INFO,
    [
      element(ID_TIMECODE_SCALE, vint(BigInt(1_000_000))),
      element(ID_DURATION, float64(durationMs)),
      element(ID_MUXING_APP, string('browser-tsx-sandbox')),
      element(ID_WRITING_APP, string('browser-tsx-sandbox/export')),
    ],
  );

  const track = element(
    ID_TRACK_ENTRY,
    [
      element(ID_TRACK_NUMBER, vint(BigInt(1))),
      element(ID_TRACK_UID, vint(Math.floor(Math.random() * 0xfffffff) + 1)),
      element(ID_TRACK_TYPE, Uint8Array.of(1)),
      element(ID_CODEC_ID, string(codecId)),
      element(
        ID_VIDEO,
        [
          element(ID_PIXEL_WIDTH, vint(BigInt(width))),
          element(ID_PIXEL_HEIGHT, vint(BigInt(height))),
        ],
      ),
    ],
  );
  const tracks = element(ID_TRACKS, [track]);

  // Кластеры разбиваются по ~1 секунде роли.
  const clusterMaxFrames = Math.max(1, Math.round(fps));
  const clusters: Uint8Array[] = [];
  let bucket: MuxFrame[] = [];
  let clusterStartMs = 0;

  const flushCluster = () => {
    if (bucket.length === 0) return;
    const blocks: Uint8Array[] = [];
    for (const frame of bucket) {
      const relative = frame.timestampMs - clusterStartMs;
      const trackByte = Uint8Array.of(0x81);
      const timecode = uint16(relative);
      const flags = Uint8Array.of(frame.keyframe ? 0x80 : 0x00);
      blocks.push(
        element(ID_SIMPLE_BLOCK, [trackByte, timecode, flags, frame.data]),
      );
    }
    clusters.push(
      element(ID_CLUSTER, [element(ID_CLUSTER_TIMECODE, vint(BigInt(clusterStartMs))), ...blocks]),
    );
    bucket = [];
  };

  for (const frame of frames) {
    if (bucket.length >= clusterMaxFrames) flushCluster();
    if (bucket.length === 0) clusterStartMs = frame.timestampMs;
    bucket.push(frame);
  }
  flushCluster();

  // Сегмент с неизвестным размером — допустимо для потока, размер уточняется по EOF.
  const segmentHeader = [...ID_SEGMENT, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  const parts: Uint8Array[] = [ebmlHeader, Uint8Array.from(segmentHeader), info, tracks, ...clusters];
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.length;
  }
  return new Blob([buffer], { type: 'video/webm' });
}

function dataUrlToVideoFrame(
  dataUrl: string,
  width: number,
  height: number,
  timestampUs: number,
  durationUs: number,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Не удалось получить 2D-контекст для экспорта.');
        ctx.drawImage(image, 0, 0, width, height);
        resolve(new (globalThis as any).VideoFrame(canvas, { timestamp: timestampUs, duration: durationUs }));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('Не удалось декодировать кадр для экспорта.'));
    image.src = dataUrl;
  });
}

function defaultWaitRender(frameDelayMs: number): () => Promise<void> {
  return async () => {
    if (typeof requestAnimationFrame === 'function') {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    if (frameDelayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, frameDelayMs));
  };
}

/**
 * Рендерит плеер в `.webm` прямо в браузере.
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
    codec = 'vp9',
    bitrate = 5_000_000,
    frameDelayMs = 24,
    onProgress,
    signal,
  } = options;

  if (durationInFrames <= 0 || fps <= 0) {
    throw new Error('Export: durationInFrames и fps должны быть положительными.');
  }

  const waitRender = options.waitRender ?? defaultWaitRender(frameDelayMs);
  const VideoEncoderCtor = (globalThis as any).VideoEncoder;
  const encoder = new VideoEncoderCtor({
    output: (chunk: any, meta: any) => {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      frames.push({
        data: bytes,
        timestampMs: Math.round(chunk.timestamp / 1000),
        keyframe: chunk.type === 'key',
      });
      void meta;
    },
    error: (error: Error) => {
      throw error;
    },
  });

  const codecString = codec === 'vp8' ? 'vp8' : 'vp09.00.10.08';
  encoder.configure({ codec: codecString, width, height, bitrate, framerate: fps });

  const frames: MuxFrame[] = [];
  const keyFrameInterval = Math.max(1, Math.round(fps * 2));
  const timestampUsPerFrame = Math.round(1_000_000 / fps);

  try {
    for (let frame = 0; frame < durationInFrames; frame++) {
      if (signal?.aborted) throw new DOMException('Export aborted', 'AbortError');

      seekTo(frame);
      await waitRender();

      const dataUrl = await takeContainerSnapshot(container, { format: 'image/png', scale: 1 });
      const videoFrame = await dataUrlToVideoFrame(
        dataUrl,
        width,
        height,
        frame * timestampUsPerFrame,
        timestampUsPerFrame,
      );
      encoder.encode(videoFrame, { keyFrame: frame % keyFrameInterval === 0 });
      videoFrame.close();

      onProgress?.({
        frame,
        totalFrames: durationInFrames,
        progress: (frame + 1) / durationInFrames,
        phase: 'capturing',
      });
    }

    onProgress?.({ frame: durationInFrames, totalFrames: durationInFrames, progress: 1, phase: 'muxing' });
    await encoder.flush();
  } finally {
    try {
      encoder.close();
    } catch {
      // Закрытие поверх уже закрытого кодека — игнорируем.
    }
  }

  const blob = muxWebm({
    codecId: codec === 'vp8' ? 'V_VP8' : 'V_VP9',
    width,
    height,
    fps,
    frames,
  });
  onProgress?.({ frame: durationInFrames, totalFrames: durationInFrames, progress: 1, phase: 'done' });
  return blob;
}

/** Скачивает полученный Blob как файл. */
export function downloadExportBlob(blob: Blob, filename = `sandbox-export-${Date.now()}.webm`): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Проверка поддержки WebCodecs экспорта в текущем браузере. */
export function supportsBrowserExport(): boolean {
  return (
    typeof (globalThis as any).VideoEncoder !== 'undefined' &&
    typeof (globalThis as any).VideoFrame !== 'undefined'
  );
}