import { describe, it, expect, vi } from 'vitest';
import {
  collectTailwindClasses,
  createTailwindPlugin,
  extractClassNamesFromSource,
  scopedTailwindCss,
  TAILWIND_SCOPE,
  TAILWIND_VIRTUAL_MODULE,
} from './tailwind-plugin';
import { PluginPipeline } from '../core/plugin';
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

describe('plugins/tailwind.extractClassNamesFromSource (token-based)', () => {
  it('extracts classes from string literals', () => {
    const code = `<div className="flex p-4">x</div>`;
    const classes = extractClassNamesFromSource(code);
    expect(classes).toContain('flex');
    expect(classes).toContain('p-4');
  });

  it('extracts candidates from non-JSX string literals (array/object configs)', () => {
    const code = `const styles = { card: 'bg-white rounded-lg shadow' };`;
    const classes = extractClassNamesFromSource(code);
    expect(classes).toContain('bg-white');
    expect(classes).toContain('rounded-lg');
    expect(classes).toContain('shadow');
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

  it('links selectors to the player canvas and the base scope class', async () => {
    const css = await scopedTailwindCss('__tsx_tw-k1o500', ['flex', 'justify-between']);
    // Базовый scope (__tsx_tw) — его всегда вешает PlayerSandbox на data-remotion-canvas.
    expect(css).toContain('.__tsx_tw .flex');
    expect(css).toContain('.__tsx_tw .justify-between');
    // Прямой селектор канваса плеера — страховка, если базовый класс отсутствует.
    expect(css).toContain('[data-remotion-canvas="true"] .flex');
    // Полный scope-класс сохраняется.
    expect(css).toContain('.__tsx_tw-k1o500 .flex');
  });
});

describe('plugins/tailwind.createTailwindPlugin (onResolve/onLoad)', () => {
  it('injects the generated CSS into document.head (outside the sandbox membrane)', async () => {
    // Мокаем глобальный document — именно его видит код плагина на стороне фасада.
    const styleEl = { setAttribute: vi.fn(), textContent: '' };
    const head = {
      querySelector: vi.fn(() => null),
      appendChild: vi.fn((el: any) => {
        styleEl.textContent = el.textContent;
      }),
    };
    const fakeDoc = {
      head,
      createElement: vi.fn((tag: string) => (tag === 'style' ? styleEl : {})),
    };
    const savedDoc = globalThis.document;
    (globalThis as any).document = fakeDoc;

    try {
      const pipeline = new PluginPipeline([createTailwindPlugin()]);
      await pipeline.init({});

      await pipeline.runLoad(TAILWIND_VIRTUAL_MODULE, 'tailwind-virtual', {
        '/App.tsx': `<div className="flex justify-between bg-indigo-500" />`,
      });

      expect(head.appendChild).toHaveBeenCalled();
      expect(styleEl.textContent).toContain('.flex');
      expect(styleEl.textContent).toContain('.justify-between');
      expect(styleEl.textContent).toContain('__tsx_tw');
    } finally {
      (globalThis as any).document = savedDoc;
    }
  });

  it('routes virtual:tailwind.css into the tailwind-virtual namespace', async () => {
    const pipeline = new PluginPipeline([createTailwindPlugin()]);
    await pipeline.init({});

    const resolved = await pipeline.runResolve(TAILWIND_VIRTUAL_MODULE, '/App.tsx');
    expect(resolved.namespace).toBe('tailwind-virtual');

    const loaded = await pipeline.runLoad(TAILWIND_VIRTUAL_MODULE, resolved.namespace, {
      '/App.tsx': `export default () => <div className="bg-indigo-500 p-2" />;`,
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.contents).toContain('data-tailwind-jit');
    expect(loaded!.contents).toContain('.bg-indigo-500');
    expect(loaded!.contents).toContain('.p-2');
    expect(loaded!.contents).toContain('module.exports');
  });

  it('routes non-virtual imports through the default file namespace', async () => {
    const pipeline = new PluginPipeline([createTailwindPlugin()]);
    await pipeline.init({});

    const resolved = await pipeline.runResolve('./theme.ts', '/App.tsx');
    expect(resolved.namespace).toBe('file');
    expect(resolved.path).toBe('./theme.ts');
  });

  it('works end-to-end through the facade with a virtual tailwind import', async () => {
    const React = createFakeReact();
    const facade = new SandboxFacade(
      { react: React },
      { plugins: [createTailwindPlugin()] },
    );
    const result = await facade.compile(
      `import "virtual:tailwind.css";
      export default function App(){
        return <div className="bg-indigo-500 text-white p-2 rounded">hi</div>;
      }`,
    );
    expect(result.error).toBeNull();
    const rendered = result.component!({});
    expect(rendered.type).toBe('div');
    expect(rendered.props.className).toBe('bg-indigo-500 text-white p-2 rounded');
  });

  it('auto-injects the tailwind virtual import when the scene omits it', async () => {
    const React = createFakeReact();
    const facade = new SandboxFacade(
      { react: React },
      { plugins: [createTailwindPlugin()] },
    );
    const result = await facade.compile(
      `export default function App(){
        return <div className="flex justify-between p-4">hi</div>;
      }`,
    );
    expect(result.error).toBeNull();
    const rendered = result.component!({});
    expect(rendered.type).toBe('div');
    expect(rendered.props.className).toBe('flex justify-between p-4');
  });

  it('supports a custom builder', async () => {
    const builder = vi.fn((classes: string[], scopeClass: string) =>
      `.${scopeClass} {}\n/* ${classes.join(' ')} */`,
    );
    const plugin = createTailwindPlugin({ builder });
    const pipeline = new PluginPipeline([plugin]);
    await pipeline.init({});

    const loaded = await pipeline.runLoad(
      TAILWIND_VIRTUAL_MODULE,
      'tailwind-virtual',
      { '/App.tsx': `<div className="flex" />` },
    );
    expect(loaded).not.toBeNull();
    expect(builder).toHaveBeenCalled();
    const scopeClass = builder.mock.calls[0]![1] as string;
    expect(scopeClass).toMatch(new RegExp(`^${TAILWIND_SCOPE}-[a-z0-9]+$`));
    expect(loaded!.contents).toContain(`/* flex */`);
  });
});