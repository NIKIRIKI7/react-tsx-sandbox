import { describe, it, expect, vi } from 'vitest';
import { executeComponent } from './evaluator';
import { compileTsx } from '../compiler/transform';
import { SecurityError } from '../core/errors';
import { ModuleRegistry, SandboxGlobals } from '../core/types';

function createFakeReact() {
  return {
    createElement: vi.fn((type: any, props: any, ...children: any[]) => ({ type, props, children })),
  };
}

const globals = (): SandboxGlobals => ({ staticFile: () => '' });

function run(source: string, registry: ModuleRegistry, g: SandboxGlobals = globals()) {
  return executeComponent(compileTsx(source), registry, g);
}

describe('sandbox/evaluator.executeComponent', () => {
  it("throws when the 'react' module is not registered", () => {
    expect(() => run(`export default 1;`, {})).toThrow(/react.*обязателен/);
  });

  it('returns the default export of the compiled module', () => {
    const React = createFakeReact();
    const Component = run(
      `import React from 'react'; export default function C(){ return <div>hi</div>; }`,
      { react: React },
    );

    expect(typeof Component).toBe('function');
    const element = Component();
    expect(React.createElement).toHaveBeenCalled();
    expect(element.type).toBe('div');
  });

  it('injects React so JSX works even without an explicit React import', () => {
    const React = createFakeReact();
    const Component = run(`export default function C(){ return <span/>; }`, { react: React });

    expect(Component().type).toBe('span');
  });

  it('resolves registered modules through the custom require', () => {
    const React = createFakeReact();
    const Component = run(
      `import { greet } from 'mylib'; export default function C(){ return greet(); }`,
      { react: React, mylib: { greet: () => 'hello' } },
    );

    expect(Component()).toBe('hello');
  });

  it('throws a SecurityError for an unregistered module import', () => {
    const React = createFakeReact();

    expect(() => run(`import evil from 'evil'; export default evil;`, { react: React })).toThrow(
      SecurityError,
    );
    expect(() => run(`import evil from 'evil'; export default evil;`, { react: React })).toThrow(
      /evil/,
    );
  });

  it('falls back to the first named export when there is no default', () => {
    const React = createFakeReact();
    const Scene = run(`export const Scene = () => 'named-scene';`, { react: React });

    expect(typeof Scene).toBe('function');
    expect(Scene()).toBe('named-scene');
  });

  it('returns null when the module exports nothing', () => {
    const React = createFakeReact();
    expect(run(`const unused = 1;`, { react: React })).toBeNull();
  });

  it('shadows window and document to undefined', () => {
    const React = createFakeReact();
    const Component = run(
      `export default function C(){ return [typeof window, typeof document, typeof fetch]; }`,
      { react: React },
    );

    expect(Component()).toEqual(['undefined', 'undefined', 'undefined']);
  });

  it('exposes injected globals such as staticFile', () => {
    const React = createFakeReact();
    const Component = run(`export default function C(){ return staticFile('logo.png'); }`, {
      react: React,
    }, { staticFile: (file) => `blob:${file}` });

    expect(Component()).toBe('blob:logo.png');
  });

  it('supports arbitrary additional globals', () => {
    const React = createFakeReact();
    const Component = run(`export default function C(){ return customValue + 1; }`, {
      react: React,
    }, { staticFile: () => '', customValue: 41 });

    expect(Component()).toBe(42);
  });

  it('wraps evaluation-time errors into a Runtime Error', () => {
    const React = createFakeReact();

    expect(() => run(`throw new Error('kaboom');`, { react: React })).toThrow(
      '[Runtime Error]: kaboom',
    );
  });

  it('supports useState hooks from the registered React module', () => {
    const React = {
      createElement: vi.fn(),
      useState: vi.fn((initial: unknown) => [initial, () => {}]),
    };
    const Component = run(
      `import React, { useState } from 'react'; export default function C(){ const [n] = useState(5); return n; }`,
      { react: React },
    );

    expect(Component()).toBe(5);
  });
});
