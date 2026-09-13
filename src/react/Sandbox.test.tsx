// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Sandbox } from './Sandbox';

describe('react/Sandbox (UI-компонент)', () => {
  it('компилирует и рендерит переданный TSX', async () => {
    render(<Sandbox config={{ code: `export default function C(){ return <span>Hello UI</span>; }` }} />);

    expect(await screen.findByText('Hello UI')).toBeTruthy();
  });

  it('применяет className и style к контейнеру', async () => {
    const { container } = render(
      <Sandbox
        config={{
          code: `export default function C(){ return <span>Boxed</span>; }`,
          className: 'my-preview',
          style: { height: 123 },
        }}
      />,
    );

    await screen.findByText('Boxed');
    const box = container.querySelector('[data-tsx-sandbox]') as HTMLElement;

    expect(box).toBeTruthy();
    expect(box.className).toBe('my-preview');
    expect(box.style.height).toBe('123px');
  });

  it('передаёт modules и assets (staticFile)', async () => {
    render(
      <Sandbox
        config={{
          code: `export default function C(){ return <span>{staticFile('logo.png')}</span>; }`,
          assets: { 'logo.png': 'blob:logo' },
        }}
      />,
    );

    expect(await screen.findByText('blob:logo')).toBeTruthy();
  });

  it('использует кастомный importer для внешних пакетов', async () => {
    const importer = vi.fn(async () => ({ default: () => 'from-cdn' }));

    render(
      <Sandbox
        config={{
          code: `import lib from 'my-lib'; export default function C(){ return <span>{lib()}</span>; }`,
          importer,
        }}
      />,
    );

    expect(await screen.findByText('from-cdn')).toBeTruthy();
    expect(importer).toHaveBeenCalledWith('https://esm.sh/my-lib');
  });

  it('показывает renderLoading до завершения компиляции', () => {
    render(
      <Sandbox
        config={{
          code: `export default function C(){ return <span>later</span>; }`,
          renderLoading: () => <div data-testid="loading">compiling</div>,
        }}
      />,
    );

    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('показывает ошибку компиляции по умолчанию', async () => {
    render(<Sandbox config={{ code: 'const = ;' }} />);

    expect(await screen.findByText(/\[Compiler Error\]/)).toBeTruthy();
  });

  it('поддерживает кастомный renderError', async () => {
    render(
      <Sandbox
        config={{
          code: 'const = ;',
          renderError: (ctx) => <div data-testid="err">{ctx.error.name}</div>,
        }}
      />,
    );

    expect((await screen.findByTestId('err')).textContent).toBe('CompilerError');
  });

  it('поддерживает полный контроль через render-слот', async () => {
    render(
      <Sandbox
        config={{
          code: `export default function C(){ return <span>X</span>; }`,
          render: (ctx) => (
            <div data-testid="slot">
              {ctx.Component ? 'ready' : ctx.isCompiling ? 'loading' : 'idle'}
            </div>
          ),
        }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('slot').textContent).toBe('ready'));
  });

  it('оборачивает компонент в wrapper', async () => {
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <section data-testid="wrap">{children}</section>
    );

    render(
      <Sandbox
        config={{ code: `export default function C(){ return <span>Wrapped</span>; }`, wrapper: Wrapper }}
      />,
    );

    expect(await screen.findByTestId('wrap')).toBeTruthy();
    expect(screen.getByText('Wrapped')).toBeTruthy();
  });

  it('вызывает onCompiled с компонентом и временем', async () => {
    const onCompiled = vi.fn();

    render(
      <Sandbox
        config={{ code: `export default function C(){ return <span>done</span>; }`, onCompiled }}
      />,
    );

    await screen.findByText('done');
    await waitFor(() => expect(onCompiled).toHaveBeenCalledTimes(1));

    const info = onCompiled.mock.calls[0][0];
    expect(typeof info.component).toBe('function');
    expect(typeof info.executionTimeMs).toBe('number');
  });

  it('вызывает onError при ошибке', async () => {
    const onError = vi.fn();

    render(<Sandbox config={{ code: 'const = ;', onError }} />);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0].name).toBe('CompilerError');
  });
});
