import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  exportBrowserVideo,
  supportsBrowserExport,
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