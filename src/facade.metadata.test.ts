import { describe, it, expect, vi } from 'vitest';
import { SandboxFacade } from './facade';

function createFakeReact() {
  return {
    createElement: vi.fn((type: any, props: any, ...children: any[]) => ({ type, props, children })),
  };
}

describe('facade: автоизвлечение параметров сцены (Scene Metadata)', () => {
  it('compile() извлекает metadata из compositionConfig анимации (только код, без пропсов)', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const result = await facade.compile(`
      export const compositionConfig = {
        id: 'ReelA',
        durationInFrames: 240,
        fps: 60,
        width: 1080,
        height: 1920,
        defaultProps: { title: 'Привет' },
      };
      export default function Scene({ title }: any) { return { title }; }
    `);

    expect(result.error).toBeNull();
    expect(result.metadata?.id).toBe('ReelA');
    expect(result.metadata?.durationInFrames).toBe(240);
    expect(result.metadata?.fps).toBe(60);
    expect(result.metadata?.width).toBe(1080);
    expect(result.metadata?.height).toBe(1920);
    expect(result.metadata?.defaultProps).toEqual({ title: 'Привет' });
    expect(result.exports?.compositionConfig?.id).toBe('ReelA');
  });

  it('compile() извлекает metadata из отдельных экспортов', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const result = await facade.compile(`
      export const durationInFrames = 90;
      export const fps = 24;
      export const width = 1280;
      export const height = 720;
      export default function Scene() { return null; }
    `);

    expect(result.error).toBeNull();
    expect(result.metadata?.durationInFrames).toBe(90);
    expect(result.metadata?.fps).toBe(24);
    expect(result.metadata?.width).toBe(1280);
    expect(result.metadata?.height).toBe(720);
  });

  it('compile() извлекает metadata из статических полей компонента', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const result = await facade.compile(`
      export default function Scene() { return null; }
      Scene.durationInFrames = 150;
      Scene.fps = 25;
      Scene.width = 480;
      Scene.height = 854;
    `);

    expect(result.error).toBeNull();
    expect(result.metadata?.durationInFrames).toBe(150);
    expect(result.metadata?.fps).toBe(25);
    expect(result.metadata?.width).toBe(480);
    expect(result.metadata?.height).toBe(854);
  });

  it('compile() извлекает metadata из <Composition/> в тексте кода', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const result = await facade.compile(`
      const template = '<Composition id="Tag" durationInFrames={99} fps={12} width={640} height={360} />';
      export default function Scene() { return null; }
    `);

    expect(result.error).toBeNull();
    expect(result.metadata?.durationInFrames).toBe(99);
    expect(result.metadata?.fps).toBe(12);
    expect(result.metadata?.width).toBe(640);
    expect(result.metadata?.height).toBe(360);
  });

  it('compile() на VFS извлекает metadata из JSON сцены и TSX', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const result = await facade.compile({
      '/scene.json': JSON.stringify({ durationInFrames: 300, fps: 30 }),
      '/App.tsx': `
        export const compositionConfig = { width: 1080, height: 1920, defaultProps: { title: 'VFS' } };
        export default function Scene() { return null; }
      `,
    });

    expect(result.error).toBeNull();
    expect(result.metadata?.durationInFrames).toBe(300);
    expect(result.metadata?.fps).toBe(30);
    expect(result.metadata?.width).toBe(1080);
    expect(result.metadata?.height).toBe(1920);
    expect(result.metadata?.defaultProps).toEqual({ title: 'VFS' });
  });

  it('compile() с одним только JSON возвращает metadata даже без компонента', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const result = await facade.compile(
      JSON.stringify({ durationInFrames: 180, fps: 30, width: 1280, height: 720 }),
    );

    expect(result.metadata?.durationInFrames).toBe(180);
    expect(result.metadata?.width).toBe(1280);
    expect(result.metadata?.height).toBe(720);
  });

  it('hmrUpdate() извлекает metadata на первом и последующих обновлениях', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const first = await facade.hmrUpdate({
      '/App.tsx': `
        export const compositionConfig = { durationInFrames: 60, fps: 30, width: 640, height: 360 };
        export default function Scene() { return null; }
      `,
    });
    expect(first.metadata?.durationInFrames).toBe(60);

    const second = await facade.hmrUpdate({
      '/App.tsx': `
        export const compositionConfig = { durationInFrames: 120, fps: 25, width: 800, height: 600 };
        export default function Scene() { return null; }
      `,
    });
    expect(second.metadata?.durationInFrames).toBe(120);
    expect(second.metadata?.fps).toBe(25);
    expect(second.metadata?.width).toBe(800);
    expect(second.metadata?.height).toBe(600);
    expect(second.hmr.changed).toContain('/App.tsx');
  });
});