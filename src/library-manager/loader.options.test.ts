import { describe, it, expect, vi } from 'vitest';
import { loadMissingModules } from './loader';
import { ModuleCache } from './cache';

describe('library-manager/loader: options (cdnResolver, signal)', () => {
  it('использует кастомный cdnResolver', async () => {
    const cache = new ModuleCache();
    const importer = vi.fn(async () => ({ default: 1 }));

    await loadMissingModules(['react'], cache, {
      importer,
      cdnResolver: (pkg) => `https://cdn.test/${pkg}`,
    });

    expect(importer).toHaveBeenCalledWith('https://cdn.test/react');
    expect(cache.has('react')).toBe(true);
  });

  it('прерывает загрузку по AbortSignal', async () => {
    const cache = new ModuleCache();
    const controller = new AbortController();
    controller.abort();
    const importer = vi.fn(async () => ({}));

    await expect(
      loadMissingModules(['x'], cache, { importer, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(importer).not.toHaveBeenCalled();
  });

  it('пропускает уже закэшированные пакеты', async () => {
    const cache = new ModuleCache({ react: {} });
    const importer = vi.fn(async () => ({}));

    await loadMissingModules(['react'], cache, { importer });

    expect(importer).not.toHaveBeenCalled();
  });
});
