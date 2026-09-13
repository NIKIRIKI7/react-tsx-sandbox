// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLiveSandbox } from './useLiveSandbox';

function Harness({ code, assets }: { code: string; assets?: Record<string, string> }) {
  const sandbox = assets ? useLiveSandbox(code, {}, assets) : useLiveSandbox(code, {});
  const { Component, error, isCompiling } = sandbox;

  if (error) return <div data-testid="error">{error.message}</div>;
  if (isCompiling) return <div data-testid="loading">compiling</div>;
  if (!Component) return <div data-testid="empty">empty</div>;
  return <Component />;
}

describe('react/useLiveSandbox', () => {
  it('compiles and renders the provided component', async () => {
    render(<Harness code={`export default function C(){ return <span>Hello Sandbox</span>; }`} />);

    expect(await screen.findByText('Hello Sandbox')).toBeTruthy();
  });

  it('exposes a compilation error instead of crashing', async () => {
    render(<Harness code={'const = ;'} />);

    const error = await screen.findByTestId('error');
    expect(error.textContent).toContain('[Compiler Error]');
  });

  it('recompiles when the code prop changes', async () => {
    const { rerender } = render(
      <Harness code={`export default function C(){ return <span>first</span>; }`} />,
    );
    expect(await screen.findByText('first')).toBeTruthy();

    rerender(<Harness code={`export default function C(){ return <span>second</span>; }`} />);

    expect(await screen.findByText('second')).toBeTruthy();
  });

  it('passes local assets through the staticFile helper', async () => {
    render(
      <Harness
        code={`export default function C(){ return <span>{staticFile('logo.png')}</span>; }`}
        assets={{ 'logo.png': 'blob:logo' }}
      />,
    );

    expect(await screen.findByText('blob:logo')).toBeTruthy();
  });

  it('does not enter an infinite recompile loop with a default assets object', async () => {
    let renders = 0;

    function CountingHarness({ code }: { code: string }) {
      renders += 1;
      const { Component, isCompiling } = useLiveSandbox(code, {});
      if (isCompiling || !Component) return <div>loading</div>;
      return <Component />;
    }

    render(<CountingHarness code={`export default function C(){ return <span>stable</span>; }`} />);
    expect(await screen.findByText('stable')).toBeTruthy();

    const rendersAfterMount = renders;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(renders).toBe(rendersAfterMount);
  });
});
