import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  calculateBitrate,
  exportBrowserVideo,
  supportsBrowserExport,
  toEvenFrameSize,
} from './browser-export';

class FakeVideoEncoder {
  configure() {}
  encode() {}
  flush() {
    return Promise.resolve();
  }
  close() {}
}

// Мокаем классы Mediabunny для прогона тестов в Node.js без реального WebCodecs API
vi.mock('mediabunny', () => {
  class BufferTarget {
    buffer = new Uint8Array([1, 2, 3]);
  }
  class CanvasSource {
    constructor() {}
    async add() {}
    close() {}
  }
  class Output {
    target: any;
    constructor({ target }: any) {
      this.target = target;
    }
    addVideoTrack() {}
    async start() {}
    async finalize() {}
  }
  class Mp4OutputFormat {}
  class WebMOutputFormat {}

  return { Output, BufferTarget, CanvasSource, Mp4OutputFormat, WebMOutputFormat };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('export/browser-export.support detection', () => {
  it('reports false when WebCodecs is missing (node)', () => {
    expect(supportsBrowserExport()).toBe(false);
  });

  it('reports true when WebCodecs API is present', () => {
    vi.stubGlobal('VideoEncoder', FakeVideoEncoder);
    expect(supportsBrowserExport()).toBe(true);
  });
});

describe('export/browser-export.toEvenFrameSize', () => {
  it('rounds odd dimensions down to the nearest even number', () => {
    expect(toEvenFrameSize(233)).toBe(232);
    expect(toEvenFrameSize(415)).toBe(414);
  });

  it('keeps even dimensions unchanged and clamps tiny values to 2', () => {
    expect(toEvenFrameSize(414)).toBe(414);
    expect(toEvenFrameSize(1)).toBe(2);
  });
});

describe('export/browser-export.calculateBitrate', () => {
  it('scales bitrate by quality preset', () => {
    // В новой версии quality: 'high' имеет множитель 0.3
    expect(calculateBitrate(1920, 1080, 30, 'high')).toBe(Math.round(62_208_000 * 0.3));
  });
});

describe('export/browser-export.exportBrowserVideo', () => {
  it('throws a descriptive error when WebCodecs is missing', async () => {
    await expect(
      exportBrowserVideo({
        container: {} as any,
        durationInFrames: 10,
        fps: 30,
        width: 100,
        height: 100,
        seekTo: () => {},
      }),
    ).rejects.toThrow(/Ваш браузер не поддерживает WebCodecs API \(VideoEncoder\)/);
  });

  it('validates positive duration and fps before encoding', async () => {
    vi.stubGlobal('VideoEncoder', FakeVideoEncoder);
    await expect(
      exportBrowserVideo({
        container: {} as any,
        durationInFrames: 0,
        fps: 30,
        width: 100,
        height: 100,
        seekTo: () => {},
      }),
    ).rejects.toThrow(/durationInFrames и fps должны быть положительными/);
  });

  it('aborts cleanly via AbortSignal', async () => {
    vi.stubGlobal('VideoEncoder', FakeVideoEncoder);
    const controller = new AbortController();
    controller.abort();
    await expect(
      exportBrowserVideo({
        container: {} as any,
        durationInFrames: 5,
        fps: 30,
        width: 100,
        height: 100,
        seekTo: () => {},
        signal: controller.signal,
      }),
    ).rejects.toThrow(/abort/i);
  });
});