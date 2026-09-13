// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { cleanupCanvasWebGl } from './webgl-guard';

describe('sandbox/webgl-guard', () => {
  it('высвобождает WebGL-контекст у canvas', () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const loseContext = vi.fn();
    canvas.getContext = vi.fn(() => ({
      getExtension: vi.fn((name: string) =>
        name === 'WEBGL_lose_context' ? { loseContext } : null,
      ),
    })) as never;

    expect(cleanupCanvasWebGl(container)).toBe(1);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('безопасно работает с null', () => {
    expect(cleanupCanvasWebGl(null)).toBe(0);
  });
});
