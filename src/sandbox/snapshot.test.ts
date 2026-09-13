// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { takeContainerSnapshot } from './snapshot';

describe('sandbox/snapshot', () => {
  it('бросает ошибку без контейнера', async () => {
    await expect(takeContainerSnapshot(null)).rejects.toThrow(/контейнер/i);
  });

  it('использует прямой canvas, если он есть', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    const dataUrl = 'data:image/png;base64,AAAA';
    canvas.toDataURL = vi.fn(() => dataUrl);
    container.appendChild(canvas);

    const result = await takeContainerSnapshot(container, { format: 'image/png' });

    expect(result).toBe(dataUrl);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png', 0.95);
  });
});
