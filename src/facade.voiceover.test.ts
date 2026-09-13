import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { SandboxFacade } from './facade';
import { extractBareImports } from './compiler/analyzer';

const sceneSource = readFileSync(
  fileURLToPath(new URL('../examples/voiceover-animation.tsx', import.meta.url)),
  'utf8',
);

const RemotionStub = {
  AbsoluteFill: (props: any) => props,
  Audio: (props: any) => props,
  Sequence: (props: any) => props,
  staticFile: (filename: string) => filename,
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, durationInFrames: 300, width: 1280, height: 720 }),
  spring: () => 1,
  interpolate: (
    input: number,
    inputRange: number[],
    outputRange: number[],
    options?: { extrapolateLeft?: string; extrapolateRight?: string },
  ) => {
    if (input <= inputRange[0]) return outputRange[0];
    const last = inputRange.length - 1;
    if (input >= inputRange[last]) {
      return options?.extrapolateRight === 'clamp' ? outputRange[last] : outputRange[last];
    }
    for (let i = 0; i < last; i += 1) {
      const from = inputRange[i];
      const to = inputRange[i + 1];
      if (input >= from && input <= to) {
        const t = (input - from) / (to - from);
        return outputRange[i] + t * (outputRange[i + 1] - outputRange[i]);
      }
    }
    return outputRange[last];
  },
};

const LucideStub = new Proxy(
  {},
  { get: (_target, name) => (props: any) => ({ icon: name, props }) },
);

const TimelineStub = {
  MusicLayer: (props: any) => ({ layer: 'music', props }),
  SFXLayer: (props: any) => ({ layer: 'sfx', props }),
  TrackLayer: (props: any) => ({ layer: 'track', props }),
  useActiveCues: (cues: any[], type?: string) =>
    cues.filter((cue) => (type ? cue.type === type : true)),
};

function createFacade() {
  return new SandboxFacade({
    react: React,
    remotion: RemotionStub,
    'lucide-react': LucideStub,
    'browser-tsx-sandbox': TimelineStub,
  });
}

describe('examples/voiceover-animation (озвучка + музыка + SFX)', () => {
  it('находит внешние зависимости сцены', () => {
    expect(extractBareImports(sceneSource).sort()).toEqual([
      'browser-tsx-sandbox',
      'lucide-react',
      'react',
      'remotion',
    ]);
  });

  it('компилирует и строит аудио-слои из массива cues', async () => {
    const facade = createFacade();
    const { component: Scene, error } = await facade.compile(sceneSource);
    expect(error).toBeNull();

    const element = (Scene as any)() as any;
    const children = React.Children.toArray(element.props.children);

    const music = children.find((child: any) => child?.type === TimelineStub.MusicLayer) as any;
    const sfx = children.find((child: any) => child?.type === TimelineStub.SFXLayer) as any;
    const track = children.find((child: any) => child?.type === TimelineStub.TrackLayer) as any;

    expect(music).toBeTruthy();
    expect(sfx).toBeTruthy();
    expect(track).toBeTruthy();
    expect(music.props.cues).toHaveLength(9);

    const voice = music.props.cues.find((cue: any) => cue.type === 'voice');
    expect(voice.payload.src).toBe('voice/voice_01.wav');
    expect(voice.durationInFrames).toBe(240);

    expect(sfx.props.cues.filter((c: any) => c.type === 'sfx')).toHaveLength(3);
  });

  it('ducking музыки реагирует на озвучку (30..270 кадр)', async () => {
    const facade = createFacade();
    const { component: Scene } = await facade.compile(sceneSource);
    const element = (Scene as any)() as any;
    const children = React.Children.toArray(element.props.children);
    const music = children.find((child: any) => child?.type === TimelineStub.MusicLayer) as any;

    const duck = music.props.volumeDucking;
    expect(duck(0)).toBe(1);
    expect(duck(150)).toBeCloseTo(0.2);
  });
});
