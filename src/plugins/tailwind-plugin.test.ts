import { describe, it, expect, vi } from 'vitest';
import {
  collectTailwindClasses,
  createTailwindJitPlugin,
  scopedTailwindCss,
  TAILWIND_SCOPE,
} from './tailwind-plugin';
import { SandboxFacade } from '../facade';

function createFakeReact() {
  return {
    createElement: vi.fn((type: any, props: any, ...children: any[]) => ({ type, props, children })),
  };
}

describe('plugins/tailwind.collectTailwindClasses', () => {
  it('collects string literal classNames', () => {
    const code = `<div className="flex p-4 bg-red-500 text-white">x</div>`;
    expect(collectTailwindClasses(code)).toEqual(['bg-red-500', 'flex', 'p-4', 'text-white']);
  });

  it('collects single-quoted and template literal classNames', () => {
    const code = `const a = <div className={'m-2 text-xl'} />;
const b = <div className={\`grid grid-cols-3\`} />;`;
    const classes = collectTailwindClasses(code);
    expect(classes).toContain('m-2');
    expect(classes).toContain('text-xl');
    expect(classes).toContain('grid');
    expect(classes).toContain('grid-cols-3');
  });

  it('deduplicates and sorts tokens', () => {
    const code = `<div className="flex flex p-1 p-4" />`;
    expect(collectTailwindClasses(code)).toEqual(['flex', 'p-1', 'p-4']);
  });

  it('ignores interpolated templates', () => {
    const code = `className={\`p-\${size}\`}`;
    expect(collectTailwindClasses(code)).toEqual([]);
  });

  it('keeps arbitrary values and opacity modifiers', () => {
    const code = `<div className="text-[9px] bg-cyan-400/70 w-1/2" />`;
    const classes = collectTailwindClasses(code);
    expect(classes).toContain('text-[9px]');
    expect(classes).toContain('bg-cyan-400/70');
    expect(classes).toContain('w-1/2');
  });
});

describe('plugins/tailwind.scopedTailwindCss (Tailwind v4 JIT)', () => {
  it('scopes every utility to the wrapper class', async () => {
    const css = await scopedTailwindCss('tw-scope', ['bg-blue-500', 'p-4']);
    expect(css).toContain('.tw-scope .bg-blue-500');
    expect(css).toContain('.tw-scope .p-4');
    expect(css).toContain('padding:');
    expect(css).toContain('background-color:');
    expect(css).not.toMatch(/(?:^|\n)\.bg-blue-500\s*\{/);
  });

  it('anchors theme variables to the wrapper class instead of :root', async () => {
    const css = await scopedTailwindCss('tw-scope', ['bg-blue-500']);
    expect(css).toContain('.tw-scope');
    expect(css).not.toMatch(/(?:^|\n):root/);
  });

  it('supports color opacity modifiers via v4 color-mix', async () => {
    const css = await scopedTailwindCss('s', ['bg-red-500/10']);
    expect(css).toContain('.s .bg-red-500\\/10');
    expect(css).toMatch(/10%|0\.1/);
  });

  it('emits keyframes once for animate utilities', async () => {
    const css = await scopedTailwindCss('s', ['animate-bounce']);
    expect(css).toContain('@keyframes bounce');
    expect(css).toContain('.s .animate-bounce');
  });

  it('skips unknown utility classes', async () => {
    const css = await scopedTailwindCss('s', ['definitely-not-a-class']);
    expect(css).not.toContain('definitely-not-a-class');
  });

  it('supports v4 arbitrary values and gradients', async () => {
    const css = await scopedTailwindCss('s', [
      'h-[123px]',
      'bg-gradient-to-r',
      'from-cyan-500',
      'text-[9px]',
    ]);
    expect(css).toContain('.s .h-\\[123px\\]');
    expect(css).toContain('123px');
    expect(css).toContain('.s .bg-gradient-to-r');
    expect(css).toContain('.s .text-\\[9px\\]');
    expect(css).toContain('9px');
  });

  it('scopes variants (hover:, responsive) without leaking outside the wrapper', async () => {
    const css = await scopedTailwindCss('s', ['hover:bg-slate-700', 'md:flex', 'bg-white/10']);
    expect(css).toContain('.s .hover\\:bg-slate-700:hover');
    expect(css).toContain('@media (width >= 48rem)');
    expect(css).toContain('.s .md\\:flex');
    expect(css).toContain('.s .bg-white\\/10');
  });
});

describe('plugins/tailwind.createTailwindJitPlugin', () => {
  it('wraps exports.default in a scoped component after compile', async () => {
    const plugin = createTailwindJitPlugin();
    const compiled = await plugin.afterCompile!('exports.default = function C(){ return 1; };', '/App.tsx');
    expect(compiled).toContain('className: scopeCls');
    expect(compiled).toContain(`var scopeCls = "${TAILWIND_SCOPE}-`);
    expect(compiled).toContain('dangerouslySetInnerHTML');
    expect(compiled).toContain('exports.default = TailwindJitWrapper');
  });

  it('works end-to-end through the facade with a Tailwind-annotated component', async () => {
    const React = createFakeReact();
    const facade = new SandboxFacade(
      { react: React },
      { plugins: [createTailwindJitPlugin()] },
    );
    const result = await facade.compile(
      `export default function App(){
        return <div className="bg-indigo-500 text-white p-2 rounded">hi</div>;
      }`,
    );
    expect(result.error).toBeNull();
    const rendered = result.component!({});
    expect(rendered.type).toBe('div');
    expect(rendered.props.className).toMatch(new RegExp(`^${TAILWIND_SCOPE}-`));
    expect(rendered.children.length).toBe(2);
    const styleTag = rendered.children[0];
    expect(styleTag.type).toBe('style');
    expect(styleTag.props.dangerouslySetInnerHTML.__html).toContain('.bg-indigo-500');
    expect(styleTag.props.dangerouslySetInnerHTML.__html).toContain(rendered.props.className);
  });

  it('invokes a custom builder instead of the built-in catalog', async () => {
    const builder = vi.fn(() => '');
    const plugin = createTailwindJitPlugin({ builder });
    plugin.beforeCompile?.(`<div className="flex" />`, '/App.tsx');
    const compiled = await plugin.afterCompile!('exports.default = () => null;', '/App.tsx');
    const call = builder.mock.calls[0] as unknown as [string[], string];
    expect(call[0]).toEqual(['flex']);
    expect(call[1]).toMatch(new RegExp(`^${TAILWIND_SCOPE}-[a-z0-9]+$`));
    expect(compiled).toContain('');
  });
});