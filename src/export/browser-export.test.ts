import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  exportBrowserVideo,
  muxWebm,
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
    vi.stubGlobal('VideoFrame', class {});
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
    ).rejects.toThrow(/нет поддержки WebCodecs \(VideoEncoder, VideoFrame\)/);
  });

  it('validates positive duration and fps before encoding', async () => {
    vi.stubGlobal('VideoEncoder', FakeVideoEncoder);
    vi.stubGlobal('VideoFrame', class {});

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
    vi.stubGlobal('VideoFrame', class {});

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

describe('export/browser-export.muxWebm', () => {
  it('produces a webm Blob with a valid EBML header', async () => {
    const blob = muxWebm({
      codecId: 'V_VP9',
      width: 320,
      height: 180,
      fps: 1,
      frames: [
        { data: new Uint8Array([0x10, 0x20, 0x30, 0x40]), timestampMs: 0, keyframe: true },
        { data: new Uint8Array([0x50, 0x60]), timestampMs: 1000, keyframe: false },
      ],
    });

    expect(blob.type).toBe('video/webm');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    // EBML Magic: 1A 45 DF A3
    expect(bytes[0]).toBe(0x1a);
    expect(bytes[1]).toBe(0x45);
    expect(bytes[2]).toBe(0xdf);
    expect(bytes[3]).toBe(0xa3);
  });

  it('embeds the codec id in the CodecID element', async () => {
    const blob = muxWebm({
      codecId: 'V_VP8',
      width: 16,
      height: 16,
      fps: 2,
      frames: [{ data: new Uint8Array([1]), timestampMs: 0, keyframe: true }],
    });

    const text = await blob.text();
    expect(text).toContain('V_VP8');
    expect(text).toContain('webm');
  });
});