import { describe, it, expect, vi } from 'vitest';
import { SandboxFacade } from './facade';
import { CompilerError, NetworkModuleError } from './core/errors';
import { ModuleImporter } from './library-manager/loader';

function createFakeReact() {
  return {
    createElement: vi.fn((type: any, props: any, ...children: any[]) => ({ type, props, children })),
  };
}

describe('facade.SandboxFacade', () => {
  it('compiles a TSX component using the pre-registered React', async () => {
    const React = createFakeReact();
    const facade = new SandboxFacade({ react: React });

    const result = await facade.compile(
      `import React from 'react'; export default function C(){ return <div/>; }`,
    );

    expect(result.error).toBeNull();
    expect(typeof result.component).toBe('function');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('does not touch the network for pre-registered modules', async () => {
    const React = createFakeReact();
    const importer = vi.fn(async () => {
      throw new Error('should not be called');
    });
    const facade = new SandboxFacade({ react: React }, importer);

    const result = await facade.compile(`import React from 'react'; export default () => null;`);

    expect(result.error).toBeNull();
    expect(importer).not.toHaveBeenCalled();
  });

  it('resolves assets through the staticFile global', async () => {
    const React = createFakeReact();
    const facade = new SandboxFacade({ react: React });
    facade.setAssets({ 'logo.png': 'blob:logo' });

    const result = await facade.compile(
      `export default function C(){ return [staticFile('logo.png'), staticFile('missing.png')]; }`,
    );

    expect(result.error).toBeNull();
    expect(result.component()).toEqual(['blob:logo', '']);
  });

  it('returns a CompilerError result instead of throwing on invalid TSX', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const result = await facade.compile('const = ;');

    expect(result.component).toBeNull();
    expect(result.error).toBeInstanceOf(CompilerError);
  });

  it('downloads missing libraries through the injected importer', async () => {
    const React = createFakeReact();
    const importer: ModuleImporter = vi.fn(async () => ({ default: () => 'animated' }));
    const facade = new SandboxFacade({ react: React }, importer);

    const result = await facade.compile(
      `import motion from 'framer-motion'; export default function C(){ return motion(); }`,
    );

    expect(importer).toHaveBeenCalledWith('https://esm.sh/framer-motion');
    expect(result.error).toBeNull();
    expect(result.component()).toBe('animated');
  });

  it('returns a NetworkModuleError result when a library fails to load', async () => {
    const React = createFakeReact();
    const importer: ModuleImporter = vi.fn(async () => {
      throw new Error('offline');
    });
    const facade = new SandboxFacade({ react: React }, importer);

    const result = await facade.compile(`import x from 'unreachable'; export default x;`);

    expect(result.component).toBeNull();
    expect(result.error).toBeInstanceOf(NetworkModuleError);
    expect(result.error?.message).toContain('unreachable');
  });

  it('caches downloaded libraries across compilations', async () => {
    const React = createFakeReact();
    const importer: ModuleImporter = vi.fn(async () => ({ default: () => 'v' }));
    const facade = new SandboxFacade({ react: React }, importer);

    await facade.compile(`import lib from 'my-lib'; export default lib;`);
    await facade.compile(`import lib from 'my-lib'; export default lib;`);

    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('surfaces runtime errors as an error result', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const result = await facade.compile(`throw new Error('boom');`);

    expect(result.component).toBeNull();
    expect(result.error?.message).toContain('boom');
  });
});
