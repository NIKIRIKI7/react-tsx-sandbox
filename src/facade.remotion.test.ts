import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { SandboxFacade } from './facade';
import { extractBareImports } from './compiler/analyzer';
import { compileTsx } from './compiler/transform';

const sceneSource = readFileSync(
  fileURLToPath(new URL('../examples/remotion-scene.tsx', import.meta.url)),
  'utf8',
);

// Минимальные заглушки, заменяющие реальные `remotion` и `lucide-react`,
// чтобы протестировать пайплайн компиляции/выполнения без сети и рендера видео.
const RemotionStub = {
  AbsoluteFill: (props: any) => props,
  Sequence: (props: any) => props,
  OffthreadVideo: (props: any) => props,
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, durationInFrames: 1177, width: 1920, height: 1080 }),
  spring: () => 1,
  interpolate: (input: number) => input,
  Easing: { out: (fn: any) => fn, cubic: (t: number) => t },
};

const LucideStub = new Proxy(
  {},
  {
    get: (_target, name) => (props: any) => ({ icon: name, props }),
  },
);

function createFacade() {
  return new SandboxFacade({
    react: React,
    remotion: RemotionStub,
    'lucide-react': LucideStub,
  });
}

describe('examples/remotion-scene (интеграционный тест)', () => {
  it('находит все внешние зависимости сцены', () => {
    expect(extractBareImports(sceneSource).sort()).toEqual([
      'lucide-react',
      'react',
      'remotion',
    ]);
  });

  it('компилирует TSX-сцену в CommonJS без ошибок', () => {
    const output = compileTsx(sceneSource);

    expect(output).toContain(`require('react')`);
    expect(output).toContain(`require('remotion')`);
    expect(output).toContain(`require('lucide-react')`);
    expect(output).toContain('exports.Scene');
    expect(output).toContain('exports.compositionConfig');
    expect(output).toMatch(/exports\.\s*default/);
  });

  it('компилирует и вычисляет сцену через SandboxFacade', async () => {
    const facade = createFacade();

    const result = await facade.compile(sceneSource);

    expect(result.error).toBeNull();
    expect(typeof result.component).toBe('function');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('возвращает корневой React-элемент при вызове Scene', async () => {
    const facade = createFacade();
    const { component: Scene } = await facade.compile(sceneSource);

    const element = Scene();

    expect(element.type).toBe(RemotionStub.AbsoluteFill);
    expect(element.props.className).toContain('overflow-hidden');
    expect(element.props.style.backgroundColor).toBe('#0b1326');

    // 7 фрагментов сцены (B-roll + анимации) как Sequence + финальный grain-оверлей.
    const children = element.props.children.filter(Boolean);
    expect(children).toHaveLength(8);

    const sequences = children.slice(0, 7);
    sequences.forEach((sequence: any) => expect(sequence.type).toBe(RemotionStub.Sequence));
    expect(children[7].type).toBe(RemotionStub.AbsoluteFill);
  });

  it('не выполняет сцену при загрузке модуля (ленивое выполнение)', async () => {
    const facade = createFacade();

    const result = await facade.compile(sceneSource);

    const element = result.component();
    expect(element).toBeTruthy();
  });
});
