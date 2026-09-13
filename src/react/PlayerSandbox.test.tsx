// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import * as Remotion from 'remotion';
import { render, screen } from '@testing-library/react';
import { PlayerSandbox } from './PlayerSandbox';

beforeAll(() => {
  if (typeof (globalThis as any).ResizeObserver === 'undefined') {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof (globalThis as any).matchMedia === 'undefined') {
    (globalThis as any).matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    });
  }
});

describe('react/PlayerSandbox (live preview через Remotion Player)', () => {
  it('рендерит скомпилированный компонент внутри Player', async () => {
    render(
      <PlayerSandbox
        config={{
          code: `export default function C(){ return <span>Player preview</span>; }`,
          controls: false,
        }}
      />,
    );

    expect(await screen.findByText('Player preview')).toBeTruthy();
  });

  it('даёт Remotion-контекст: useCurrentFrame работает (в отличие от голого Sandbox)', async () => {
    render(
      <PlayerSandbox
        config={{
          code: `
            import { useCurrentFrame } from 'remotion';
            export default function C(){ return <span>frame:{useCurrentFrame()}</span>; }
          `,
          modules: { remotion: Remotion },
          controls: false,
          fps: 30,
          durationInFrames: 60,
        }}
      />,
    );

    expect(await screen.findByText('frame:0')).toBeTruthy();
  });

  it('показывает renderLoading до завершения компиляции', () => {
    render(
      <PlayerSandbox
        config={{
          code: `export default function C(){ return <span>x</span>; }`,
          renderLoading: () => <div data-testid="loading" />,
        }}
      />,
    );

    expect(screen.getByTestId('loading')).toBeTruthy();
  });

  it('показывает ошибку компиляции', async () => {
    render(<PlayerSandbox config={{ code: 'const = ;' }} />);

    expect(await screen.findByText(/\[Compiler Error\]/)).toBeTruthy();
  });
});
