import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { SandboxFacade } from './facade';
import { extractBareImports } from './compiler/analyzer';
import { compileTsx } from './compiler/transform';

const sceneSource = readFileSync(
  fileURLToPath(new URL('../examples/audio-ducking-scene.tsx', import.meta.url)),
  'utf8',
);

// Заглушка Remotion: сохраняет типы элементов, чтобы проверить структуру сцены
// без запуска плеера/рендера.
const RemotionStub = {
  AbsoluteFill: (props: any) => props,
  Audio: (props: any) => props,
  Sequence: (props: any) => props,
  staticFile: (filename: string) => filename,
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, durationInFrames: 300, width: 1920, height: 1080 }),
  spring: () => 1,
  interpolate: (input: number) => input,
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

describe('examples/audio-ducking-scene (аудиосцена)', () => {
  it('находит внешние зависимости сцены', () => {
    expect(extractBareImports(sceneSource).sort()).toEqual(['lucide-react', 'react', 'remotion']);
  });

  it('компилирует TSX с Audio и Sequence без ошибок', () => {
    const output = compileTsx(sceneSource);
    expect(output).toContain(`require('remotion')`);
    expect(output).toContain(`require('lucide-react')`);
    expect(output).toMatch(/exports\.\s*default/);
  });

  it('компилирует и выполняет сцену через SandboxFacade', async () => {
    const facade = createFacade();
    const result = await facade.compile(sceneSource);

    expect(result.error).toBeNull();
    expect(typeof result.component).toBe('function');
  });

  it('строит таймлайн: фоновая музыка + Sequence с озвучкой', async () => {
    const facade = createFacade();
    const { component: Scene } = await facade.compile(sceneSource);

    const element = Scene() as any;
    expect(element.type).toBe(RemotionStub.AbsoluteFill);

    const children = element.props.children.filter(Boolean);
    expect(children).toHaveLength(3);

    // 1. Фоновая музыка с управляемой громкостью (ducking).
    const bgm = children[0];
    expect(bgm.type).toBe(RemotionStub.Audio);
    expect(bgm.props.src).toBe('audio/bgm.wav');
    expect(typeof bgm.props.volume).toBe('number');

    // 2. Озвучка внутри Sequence со своим отрезком таймлайна.
    const voiceSequence = children[1];
    expect(voiceSequence.type).toBe(RemotionStub.Sequence);
    expect(voiceSequence.props.from).toBe(60);
    expect(voiceSequence.props.durationInFrames).toBe(180);

    const voice = voiceSequence.props.children;
    expect(voice.type).toBe(RemotionStub.Audio);
    expect(voice.props.src).toBe('audio/voice.wav');
    expect(voice.props.volume).toBe(1);
  });
});
