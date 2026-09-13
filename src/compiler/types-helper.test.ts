import { describe, it, expect } from 'vitest';
import { getSandboxTypeDefinitions } from './types-helper';

describe('compiler/types-helper', () => {
  it('возвращает .d.ts с глобалами и remotion', () => {
    const defs = getSandboxTypeDefinitions();

    expect(defs).toHaveLength(2);
    const globals = defs.find((def) => def.filename.includes('globals'));
    const remotion = defs.find((def) => def.filename.includes('remotion'));

    expect(globals?.content).toContain('staticFile');
    expect(remotion?.content).toContain("declare module 'remotion'");
    expect(remotion?.content).toContain('useCurrentFrame');
  });
});
