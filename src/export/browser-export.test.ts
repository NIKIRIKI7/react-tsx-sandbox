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
    expect(toEvenFrameSize(233)).toBe(232);
  });

  it('keeps even dimensions unchanged and clamps tiny values to 2', () => {
    expect(toEvenFrameSize(414)).toBe(414);
    expect(toEvenFrameSize(1920)).toBe(1920);
    expect(toEvenFrameSize(1)).toBe(2);
    expect(toEvenFrameSize(0)).toBe(2);
  });
});

describe('export/browser-export.calculateBitrate', () => {
  it('scales bitrate by quality preset (BPP per pixel per second)', () => {
    // 1920×1080 @ 30fps = 62 208 000 px/s
    expect(calculateBitrate(1920, 1080, 30, 'high')).toBe(Math.round(62_208_000 * 0.2));
    expect(calculateBitrate(1920, 1080, 30, 'medium')).toBe(Math.round(62_208_000 * 0.1));
    expect(calculateBitrate(1920, 1080, 30, 'low')).toBe(Math.round(62_208_000 * 0.05));
  });

  it('gives higher bitrate for bigger resolution and more fps', () => {
    expect(calculateBitrate(1920, 1080, 30, 'high')).toBeGreaterThan(
      calculateBitrate(1280, 720, 30, 'high'),
    );
    expect(calculateBitrate(1920, 1080, 60, 'high')).toBeGreaterThan(
      calculateBitrate(1920, 1080, 30, 'high'),
    );
  });

  it('low < medium < high for the same resolution', () => {
    expect(calculateBitrate(1080, 1920, 30, 'low')).toBeLessThan(
      calculateBitrate(1080, 1920, 30, 'medium'),
    );
    expect(calculateBitrate(1080, 1920, 30, 'medium')).toBeLessThan(
      calculateBitrate(1080, 1920, 30, 'high'),
    );
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