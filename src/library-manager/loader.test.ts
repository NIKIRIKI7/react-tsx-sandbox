import { describe, it, expect, vi } from 'vitest';
import { loadMissingModules } from './loader';
import { ModuleCache } from './cache';
import { NetworkModuleError } from '../core/errors';
import * as React from 'react';

const reactDeps = `react@${React.version},react-dom@${React.version}`;
const cdn = (pkg: string) => `https://esm.sh/${pkg}?deps=${reactDeps}`;

describe('library-manager/loader.loadMissingModules', () => {
  it('fetches a missing package from esm.sh', async () => {
    const cache = new ModuleCache();
    const importer = vi.fn(async () => ({ default: () => 'module' }));

    await loadMissingModules(['framer-motion'], cache, importer);

    expect(importer).toHaveBeenCalledWith(cdn('framer-motion'));
    expect(cache.has('framer-motion')).toBe(true);
  });

  it('does not hit the network for already cached packages', async () => {
    const cache = new ModuleCache();
    cache.register('react', {});
    const importer = vi.fn(async () => ({}));

    await loadMissingModules(['react'], cache, importer);

    expect(importer).not.toHaveBeenCalled();
  });

  it('normalizes a module with a default export', async () => {
    const cache = new ModuleCache();
    const component = () => 'component';
    const importer = vi.fn(async () => ({ default: component, named: 1 }));

    await loadMissingModules(['lib'], cache, importer);

    expect(cache.get('lib')).toEqual({ default: component, named: 1, __esModule: true });
  });

  it('falls back to the module itself when there is no default export', async () => {
    const cache = new ModuleCache();
    const namespace = { a: 1, b: 2 };
    const importer = vi.fn(async () => namespace);

    await loadMissingModules(['lib'], cache, importer);

    expect(cache.get('lib').default).toBe(namespace);
  });

  it('loads several packages concurrently', async () => {
    const cache = new ModuleCache();
    const importer = vi.fn(async (url: string) => ({ default: url }));

    await loadMissingModules(['a', 'b', 'c'], cache, importer);

    expect(importer).toHaveBeenCalledTimes(3);
    expect(cache.getAll().a).toEqual({ default: cdn('a'), __esModule: true });
    expect(cache.getAll().c).toEqual({ default: cdn('c'), __esModule: true });
  });

  it('wraps network failures into a NetworkModuleError with context', async () => {
    const cache = new ModuleCache();
    const importer = vi.fn(async () => {
      throw new Error('Failed to fetch');
    });

    await expect(loadMissingModules(['broken-lib'], cache, importer)).rejects.toBeInstanceOf(
      NetworkModuleError,
    );
    await expect(loadMissingModules(['broken-lib'], cache, importer)).rejects.toThrow(
      /broken-lib/,
    );
    await expect(loadMissingModules(['broken-lib'], cache, importer)).rejects.toThrow(
      /Failed to fetch/,
    );
  });

  it('resolves without any packages', async () => {
    const importer = vi.fn(async () => ({}));

    await expect(loadMissingModules([], new ModuleCache(), importer)).resolves.toBeUndefined();
    expect(importer).not.toHaveBeenCalled();
  });
});
