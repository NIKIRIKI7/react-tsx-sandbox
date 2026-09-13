import { describe, it, expect } from 'vitest';
import { getShadowedGlobals } from './scope';

describe('sandbox/scope.getShadowedGlobals', () => {
  it('shadows the critical browser APIs', () => {
    const { forbiddenKeys } = getShadowedGlobals();

    expect(forbiddenKeys).toContain('window');
    expect(forbiddenKeys).toContain('document');
    expect(forbiddenKeys).toContain('localStorage');
    expect(forbiddenKeys).toContain('sessionStorage');
    expect(forbiddenKeys).toContain('fetch');
    expect(forbiddenKeys).toContain('XMLHttpRequest');
    expect(forbiddenKeys).toContain('indexedDB');
    expect(forbiddenKeys).toContain('navigator');
  });

  it('provides an undefined value for every forbidden key', () => {
    const { forbiddenKeys, shadowValues } = getShadowedGlobals();

    expect(shadowValues).toHaveLength(forbiddenKeys.length);
    expect(shadowValues.every((value) => value === undefined)).toBe(true);
  });

  it('returns a fresh array on every call (no shared mutable state)', () => {
    const first = getShadowedGlobals();
    first.forbiddenKeys.push('hacked');

    expect(getShadowedGlobals().forbiddenKeys).not.toContain('hacked');
  });
});
