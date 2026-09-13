// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Sandbox } from './Sandbox';

describe('Sandbox: VFS, ErrorBoundary, LoopProtect, Debounce', () => {
  it('поддерживает Virtual File System с относительными импортами', async () => {
    const files = {
      '/Button.tsx': `export const Button = () => <button>VFS-Button</button>;`,
      '/App.tsx': `
        import { Button } from './Button';
        export default function App() { return <div><Button /></div>; }
      `,
    };

    render(<Sandbox config={{ files, entry: '/App.tsx' }} />);

    expect(await screen.findByText('VFS-Button')).toBeTruthy();
  });

  it('изолирует ошибки рендера через ErrorBoundary (isRuntime)', async () => {
    render(
      <Sandbox
        config={{
          code: `
            export default function Buggy() {
              const list = null;
              return <div>{list.map((x) => x)}</div>;
            }
          `,
          renderError: ({ error, isRuntime }) => (
            <div data-testid="err">
              {isRuntime ? 'runtime' : 'compile'}:{error.name}
            </div>
          ),
        }}
      />,
    );

    const slot = await screen.findByTestId('err');
    expect(slot.textContent).toContain('runtime');
    expect(slot.textContent).toContain('RuntimeRenderError');
  });

  it('прерывает бесконечный цикл и отдаёт ExecutionTimeoutError', async () => {
    render(
      <Sandbox
        config={{
          code: `
            export default function Infinite() {
              let i = 0;
              while (true) { i++; }
              return <div>{i}</div>;
            }
          `,
          maxIterations: 100,
          renderError: ({ error, isRuntime }) => (
            <div data-testid="loop">{isRuntime ? 'runtime' : 'compile'}:{error.name}</div>
          ),
        }}
      />,
    );

    const slot = await screen.findByTestId('loop');
    expect(slot.textContent).toBe('runtime:ExecutionTimeoutError');
  });

  it('дебаунсит частый ввод и компилирует только последнюю версию', async () => {
    const onCompiled = vi.fn();

    const { rerender } = render(
      <Sandbox
        config={{ code: `export default function A(){ return <div>1</div>; }`, debounceMs: 60, onCompiled }}
      />,
    );
    rerender(
      <Sandbox
        config={{ code: `export default function A(){ return <div>2</div>; }`, debounceMs: 60, onCompiled }}
      />,
    );
    rerender(
      <Sandbox
        config={{ code: `export default function A(){ return <div>3</div>; }`, debounceMs: 60, onCompiled }}
      />,
    );

    expect(await screen.findByText('3')).toBeTruthy();
    await waitFor(() => expect(onCompiled).toHaveBeenCalledTimes(1));
  });
});
