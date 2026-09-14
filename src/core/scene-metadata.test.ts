import { describe, it, expect } from 'vitest';
import { extractSceneMetadata } from './scene-metadata';

describe('core/scene-metadata', () => {
  it('извлекает параметры из объекта compositionConfig в рассчитанных экспортах', () => {
    const code = `
      export const compositionConfig = {
        id: 'CustomReel',
        durationInFrames: 240,
        fps: 60,
        width: 1080,
        height: 1920,
        defaultProps: { title: 'Hello World' },
      };
      export default function Scene() { return null; }
    `;
    const metadata = extractSceneMetadata(code, {
      compositionConfig: {
        id: 'CustomReel',
        durationInFrames: 240,
        fps: 60,
        width: 1080,
        height: 1920,
        defaultProps: { title: 'Hello World' },
      },
    });

    expect(metadata.durationInFrames).toBe(240);
    expect(metadata.fps).toBe(60);
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
    expect(metadata.id).toBe('CustomReel');
    expect(metadata.defaultProps).toEqual({ title: 'Hello World' });
  });

  it('принимает альтернативные имена конфига: config, sceneConfig, metadata', () => {
    const viaConfig = extractSceneMetadata('', { config: { fps: 30, width: 800 } });
    expect(viaConfig.fps).toBe(30);
    expect(viaConfig.width).toBe(800);

    const viaSceneConfig = extractSceneMetadata('', { sceneConfig: { durationInFrames: 120, height: 600 } });
    expect(viaSceneConfig.durationInFrames).toBe(120);
    expect(viaSceneConfig.height).toBe(600);

    const viaMetadata = extractSceneMetadata('', { metadata: { fps: 12, width: 320 } });
    expect(viaMetadata.fps).toBe(12);
    expect(viaMetadata.width).toBe(320);
  });

  it('извлекает параметры из отдельных именованных экспортов', () => {
    const metadata = extractSceneMetadata(
      `
        export const durationInFrames = 90;
        export const fps = 24;
        export const width = 1280;
        export const height = 720;
        export default function Scene() { return null; }
      `,
      { durationInFrames: 90, fps: 24, width: 1280, height: 720 },
    );

    expect(metadata.durationInFrames).toBe(90);
    expect(metadata.fps).toBe(24);
    expect(metadata.width).toBe(1280);
    expect(metadata.height).toBe(720);
  });

  it('извлекает параметры из статических полей компонента', () => {
    function Scene() {
      return null;
    }
    Scene.durationInFrames = 150;
    Scene.fps = 60;
    Scene.width = 1080;
    Scene.height = 1920;
    Scene.defaultProps = { title: 'Static' };

    const metadata = extractSceneMetadata('', undefined, Scene);

    expect(metadata.durationInFrames).toBe(150);
    expect(metadata.fps).toBe(60);
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
    expect(metadata.defaultProps).toEqual({ title: 'Static' });
  });

  it('извлекает параметры из прямого JSON конфига', () => {
    const json = JSON.stringify({
      durationInFrames: 180,
      fps: 30,
      width: 1280,
      height: 720,
      defaultProps: { bg: '#000000' },
    });
    const metadata = extractSceneMetadata(json);

    expect(metadata.durationInFrames).toBe(180);
    expect(metadata.fps).toBe(30);
    expect(metadata.width).toBe(1280);
    expect(metadata.height).toBe(720);
    expect(metadata.defaultProps).toEqual({ bg: '#000000' });
  });

  it('извлекает параметры из схемы каталога виджетов Vidora с id 9x16', () => {
    const catalogJson = JSON.stringify({
      vidora_schema_version: '1.0',
      widgets: [
        {
          id: 'WordByWordText9x16',
          default_props: {
            durationFrames: 300,
            fontSize: 130,
            textColor: '#ffffff',
          },
        },
      ],
    });

    const metadata = extractSceneMetadata(catalogJson);

    expect(metadata.id).toBe('WordByWordText9x16');
    expect(metadata.durationInFrames).toBe(300);
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
    expect(metadata.fps).toBe(30);
    expect(metadata.defaultProps).toEqual({
      durationFrames: 300,
      fontSize: 130,
      textColor: '#ffffff',
    });
  });

  it('извлекает параметры из каталога Vidora с id 16x9', () => {
    const catalogJson = JSON.stringify({
      widgets: [
        {
          id: 'SlideShow16x9',
          default_props: { durationFrames: 240 },
        },
      ],
    });

    const metadata = extractSceneMetadata(catalogJson);

    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(1080);
    expect(metadata.durationInFrames).toBe(240);
  });

  it('работает через регулярный fallback, если переменная не была экспортирована', () => {
    const rawTsx = `
      const compositionConfig = {
        id: 'UnexportedScene',
        durationInFrames: 1177,
        fps: 30,
        width: 1920,
        height: 1080,
      };
      export default function Scene() { return null; }
    `;

    const metadata = extractSceneMetadata(rawTsx);
    expect(metadata.durationInFrames).toBe(1177);
    expect(metadata.fps).toBe(30);
    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(1080);
  });

  it('извлекает параметры из JSX-разметки <Composition .../> в тексте', () => {
    const rawTsx = `
      const template = '<Composition id="TagReel" durationInFrames={99} fps={12} width={640} height={360} />';
      export default function Scene() { return null; }
    `;

    const metadata = extractSceneMetadata(rawTsx);
    expect(metadata.id).toBe('TagReel');
    expect(metadata.durationInFrames).toBe(99);
    expect(metadata.fps).toBe(12);
    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(360);
  });

  it('сканирует .tsx/.ts/.json внутри VirtualFileSystem', () => {
    const vfs = {
      '/scene.json': JSON.stringify({ durationInFrames: 50, fps: 24 }),
      '/App.tsx': `
        export const compositionConfig = { width: 480, height: 854 };
        export default function Scene() { return null; }
      `,
    };

    const metadata = extractSceneMetadata(vfs, {
      compositionConfig: { width: 480, height: 854 },
    });

    expect(metadata.durationInFrames).toBe(50);
    expect(metadata.fps).toBe(24);
    expect(metadata.width).toBe(480);
    expect(metadata.height).toBe(854);
  });

  it('не переопределяет метаданные приоритетного источника пропсами файла ниже уровнем', () => {
    const metadata = extractSceneMetadata(
      'export const compositionConfig = { durationInFrames: 200 };',
      { compositionConfig: { durationInFrames: 200 } },
    );
    expect(metadata.durationInFrames).toBe(200);
  });

  it('приоритет: compositionConfig над defaultProps/inputProps экспортами', () => {
    const metadata = extractSceneMetadata(
      '',
      {
        compositionConfig: { defaultProps: { from: 'config' } },
        defaultProps: { from: 'named' },
      },
    );
    expect(metadata.defaultProps).toEqual({ from: 'config' });
  });
});