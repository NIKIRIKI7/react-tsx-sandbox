import { describe, it, expect } from 'vitest';
import { ModuleCache } from './cache';

describe('library-manager/cache.ModuleCache', () => {
  it('registers and retrieves a module', () => {
    const cache = new ModuleCache();
    const react = { createElement: () => null };

    cache.register('react', react);

    expect(cache.get('react')).toBe(react);
  });

  it('reports whether a module exists', () => {
    const cache = new ModuleCache();

    expect(cache.has('react')).toBe(false);
    cache.register('react', {});
    expect(cache.has('react')).toBe(true);
  });

  it('returns undefined for unknown modules', () => {
    expect(new ModuleCache().get('nope')).toBeUndefined();
  });

  it('overwrites a previously registered module', () => {
    const cache = new ModuleCache();
    cache.register('lib', 'v1');
    cache.register('lib', 'v2');

    expect(cache.get('lib')).toBe('v2');
  });

  it('returns a shallow copy that cannot mutate internal state', () => {
    const cache = new ModuleCache();
    cache.register('react', {});

    const snapshot = cache.getAll();
    delete snapshot.react;
    snapshot.injected = true;

    expect(cache.has('react')).toBe(true);
    expect(cache.has('injected')).toBe(false);
  });

  it('treats falsy registrations as absent', () => {
    const cache = new ModuleCache();
    cache.register('empty', undefined);

    expect(cache.has('empty')).toBe(false);
  });
});
