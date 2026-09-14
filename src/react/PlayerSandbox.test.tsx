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

  it('применяет mediaResolver к src медиа-компонентов Remotion (через публичный конфиг)', async () => {
    const FakeRemotion = {
      OffthreadVideo: (props: any) => <span data-testid="ot-video" data-src={props.src} />,
      delayRender: () => 1,
      continueRender: () => undefined,
    };

    render(
      <PlayerSandbox
        config={{
          code: `
            import { OffthreadVideo } from 'remotion';
            export default function C(){ return <OffthreadVideo src="C:/Users/test/clip.mp4" />; }
          `,
          modules: { remotion: FakeRemotion as any },
          controls: false,
          fps: 30,
          durationInFrames: 60,
          mediaResolver: (src) => {
            const clean = src.replace(/^file:\/\/\//i, '').replace(/\\/g, '/');
            if (/^[a-zA-Z]:[\\/]/.test(clean)) return '/@fs/' + clean;
            return src;
          },
        }}
      />,
    );

    const el = await screen.findByTestId('ot-video');
    expect(el.getAttribute('data-src')).toBe('/@fs/C:/Users/test/clip.mp4');
  });
});

describe('react/PlayerSandbox: автоопределение параметров сцены (только код/JSON, без пропсов)', () => {
  const videoConfigProbe = (params: string) => `
    import { useVideoConfig, useCurrentFrame } from 'remotion';
    ${params}
    export default function Scene({ title = 'none', marker = 'x' }: any) {
      const { width, height, fps, durationInFrames } = useVideoConfig();
      const frame = useCurrentFrame();
      return <span>{width}x{height}@{durationInFrames}fps{fps} title:{title} mark:{marker} frame:{frame}</span>;
    }
  `;

  it('вариант 1: export const compositionConfig — кадр получает 1080×1920@240fps60 и defaultProps', async () => {
    render(
      <PlayerSandbox
        config={{
          code: videoConfigProbe(`
            export const compositionConfig = {
              id: 'ReelA',
              durationInFrames: 240,
              fps: 60,
              width: 1080,
              height: 1920,
              defaultProps: { title: 'Привет', marker: 'cfg' },
            };
          `),
          modules: { remotion: Remotion },
          controls: false,
        }}
      />,
    );

    expect(await screen.findByText('1080x1920@240fps60 title:Привет mark:cfg frame:0')).toBeTruthy();
  });

  it('вариант 2: отдельные export const durationInFrames/fps/width/height', async () => {
    render(
      <PlayerSandbox
        config={{
          code: videoConfigProbe(`
            export const durationInFrames = 90;
            export const fps = 24;
            export const width = 1280;
            export const height = 720;
          `),
          modules: { remotion: Remotion },
          controls: false,
        }}
      />,
    );

    expect(await screen.findByText('1280x720@90fps24 title:none mark:x frame:0')).toBeTruthy();
  });

  it('вариант 3: статические поля Scene.durationInFrames/width/height/fps', async () => {
    render(
      <PlayerSandbox
        config={{
          code: `
            import { useVideoConfig } from 'remotion';
            export default function Scene() {
              const { width, height, fps, durationInFrames } = useVideoConfig();
              return <span>static:{width}x{height}@{durationInFrames}fps{fps}</span>;
            }
            Scene.durationInFrames = 150;
            Scene.fps = 25;
            Scene.width = 480;
            Scene.height = 854;
          `,
          modules: { remotion: Remotion },
          controls: false,
        }}
      />,
    );

    expect(await screen.findByText('static:480x854@150fps25')).toBeTruthy();
  });

  it('вариант 4: компонентные static defaultProps — inputProps доходят до анимации', async () => {
    render(
      <PlayerSandbox
        config={{
          code: `
            import { useVideoConfig } from 'remotion';
            export default function Scene({ title = 'none' }: any) {
              const { durationInFrames } = useVideoConfig();
              return <span>{durationInFrames}fps-title:{title}</span>;
            }
            Scene.defaultProps = { title: 'StaticProps' };
          `,
          modules: { remotion: Remotion },
          controls: false,
        }}
      />,
    );

    expect(await screen.findByText('300fps-title:StaticProps')).toBeTruthy();
  });

  it('вариант 5: JSX-декларация <Composition durationInFrames={99} .../> в тексте кода', async () => {
    render(
      <PlayerSandbox
        config={{
          code: `
            import { useVideoConfig } from 'remotion';
            const template = '<Composition id="Tag" durationInFrames={99} fps={12} width={640} height={360} />';
            export default function Scene() {
              const { width, height, fps, durationInFrames } = useVideoConfig();
              return <span>tag:{width}x{height}@{durationInFrames}fps{fps}</span>;
            }
          `,
          modules: { remotion: Remotion },
          controls: false,
        }}
      />,
    );

    expect(await screen.findByText('tag:640x360@99fps12')).toBeTruthy();
  });

  it('вариант 6: Vidora-каталог widgets.json в VFS — 9x16 → 1080×1920 и default_props в пропсы', async () => {
    render(
      <PlayerSandbox
        config={{
          files: {
            '/widget.json': JSON.stringify({
              vidora_schema_version: '1.0',
              widgets: [
                {
                  id: 'WordByWordText9x16',
                  default_props: {
                    durationFrames: 300,
                    title: 'Видор',
                    marker: 'v',
                  },
                },
              ],
            }),
            '/App.tsx': videoConfigProbe(''),
          },
          entry: '/App.tsx',
          modules: { remotion: Remotion },
          controls: false,
        }}
      />,
    );

    expect(await screen.findByText('1080x1920@300fps30 title:Видор mark:v frame:0')).toBeTruthy();
  });

  it('вариант 7: явные пропсы config переопределяют метаданные сцены', async () => {
    render(
      <PlayerSandbox
        config={{
          code: videoConfigProbe(`
            export const compositionConfig = {
              durationInFrames: 240,
              fps: 60,
              width: 1080,
              height: 1920,
            };
          `),
          modules: { remotion: Remotion },
          controls: false,
          durationInFrames: 10,
          fps: 30,
          width: 640,
          height: 360,
        }}
      />,
    );

    expect(await screen.findByText('640x360@10fps30 title:none mark:x frame:0')).toBeTruthy();
  });
});
