import { describe, it, expect } from 'vitest';
import { ModuleCache } from './cache';

describe('library-manager/cache: персистентность', () => {
  it('без indexedDB load/save являются no-op', async () => {
    const cache = new ModuleCache();

    expect(await cache.loadFromIndexedDb('missing')).toBeNull();
    await expect(cache.saveToIndexedDb('key', 'value')).resolves.toBeUndefined();
  });

  it('конструктор принимает начальные модули', () => {
    const cache = new ModuleCache({ react: { ok: true } });

    expect(cache.has('react')).toBe(true);
    expect(cache.get('react')).toEqual({ ok: true });
  });

  it('clear очищает реестр', () => {
    const cache = new ModuleCache({ react: {} });
    cache.clear();

    expect(cache.has('react')).toBe(false);
  });
});
