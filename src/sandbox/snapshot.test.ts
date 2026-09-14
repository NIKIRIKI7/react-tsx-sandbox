// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { prepareSnapshotClone, resolveSnapshotSize, takeContainerSnapshot } from './snapshot';

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

  it('resolveSnapshotSize отдаёт целевой размер 1:1 приоритетнее контейнера', () => {
    expect(resolveSnapshotSize({ width: 233, height: 414 }, 1080, 1920, 1)).toEqual({
      width: 1080,
      height: 1920,
    });
    expect(resolveSnapshotSize({ width: 233, height: 414 }, undefined, undefined, 1)).toEqual({
      width: 233,
      height: 414,
    });
  });

  it('prepareSnapshotClone сбрасывает zoom/pan и разворачивает композицию Remotion в 1:1', () => {
    const root = document.createElement('div');
    root.style.transform = 'scale(1.25) translate(8px, -4px)';
    root.style.width = '233px';
    root.style.height = '414px';

    const composition = document.createElement('div');
    composition.className = '__remotion-player';
    composition.style.width = '1080px';
    composition.style.height = '1920px';
    composition.style.transform = 'scale(0.215723)';
    composition.style.marginLeft = '-423.51px';
    composition.style.marginTop = '-752.906px';
    root.appendChild(composition);

    const unRelated = document.createElement('div');
    unRelated.style.width = '100px';
    root.appendChild(unRelated);

    prepareSnapshotClone(root, 1080, 1920, 1080, 1920);

    expect(root.style.transform).toBe('none');
    expect(root.style.width).toBe('1080px');
    expect(root.style.height).toBe('1920px');
    expect(composition.style.transform).toBe('scale(1)');
    expect(composition.style.marginLeft).toBe('0px');
    expect(composition.style.marginTop).toBe('0px');
    expect(unRelated.style.width).toBe('100px');
  });
});
