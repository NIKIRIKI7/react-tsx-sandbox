import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { SandboxFacade } from './facade';
import { extractBareImports } from './compiler/analyzer';
import { compileTsx } from './compiler/transform';

const sceneSource = readFileSync(
  fileURLToPath(new URL('../examples/data-driven-timeline.tsx', import.meta.url)),
  'utf8',
);

const RemotionStub = {
  AbsoluteFill: (props: any) => props,
  Audio: (props: any) => props,
  Sequence: (props: any) => props,
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, durationInFrames: 300, width: 1280, height: 720 }),
  spring: () => 1,
  interpolate: (
    input: number,
    inputRange: number[],
    outputRange: number[],
    options?: { extrapolateLeft?: string; extrapolateRight?: string },
  ) => {
    if (input <= inputRange[0]) {
      return options?.extrapolateLeft === 'clamp' ? outputRange[0] : outputRange[0];
    }
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
  {
    get: (_target, name) => (props: any) => ({ icon: name, props }),
  },
);

// Заглушки слоёв таймлайна: фиксируют переданные props для проверки сцены.
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

describe('examples/data-driven-timeline (Data-Driven таймлайн)', () => {
  it('находит внешние зависимости сцены', () => {
    expect(extractBareImports(sceneSource).sort()).toEqual([
      'browser-tsx-sandbox',
      'lucide-react',
      'react',
      'remotion',
    ]);
  });

  it('компилирует TSX со слоями таймлайна без ошибок', () => {
    const output = compileTsx(sceneSource);
    expect(output).toContain(`require('browser-tsx-sandbox')`);
    expect(output).toContain('MusicLayer');
    expect(output).toContain('SFXLayer');
    expect(output).toContain('TrackLayer');
    expect(output).toMatch(/exports\.\s*default/);
  });

  it('компилирует, выполняет и строит слои из единого массива cues', async () => {
    const facade = createFacade();
    const { component: Scene, error } = await facade.compile(sceneSource);
    expect(error).toBeNull();
    expect(typeof Scene).toBe('function');

    const element = (Scene as any)() as any;
    const children = React.Children.toArray(element.props.children);

    const music = children.find((child: any) => child?.type === TimelineStub.MusicLayer) as any;
    const sfx = children.find((child: any) => child?.type === TimelineStub.SFXLayer) as any;
    const track = children.find((child: any) => child?.type === TimelineStub.TrackLayer) as any;

    expect(music).toBeTruthy();
    expect(sfx).toBeTruthy();
    expect(track).toBeTruthy();

    // 8 событий: music, voice, 2 sfx, 2 caption, 2 sticker.
    expect(music.props.cues).toHaveLength(8);
    expect(typeof music.props.volumeDucking).toBe('function');
    expect(track.props.type).toBe('sticker');
    expect(sfx.props.cues.filter((c: any) => c.type === 'sfx')).toHaveLength(2);
  });

  it('ducking-функция музыки реагирует на активную озвучку', async () => {
    const facade = createFacade();
    const { component: Scene } = await facade.compile(sceneSource);
    const element = (Scene as any)() as any;
    const children = React.Children.toArray(element.props.children);
    const music = children.find((child: any) => child?.type === TimelineStub.MusicLayer) as any;

    const duck = music.props.volumeDucking;
    // Озвучка идёт с 60 по 180 кадр: в середине музыка приглушена, до старта — нет.
    expect(duck(0)).toBe(1);
    expect(duck(120)).toBeCloseTo(0.15);
  });
});
