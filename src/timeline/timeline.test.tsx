// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { Cue, MusicLayer, SFXLayer, TrackLayer, useActiveCues } from './index';

// Мок Remotion: фиксируем кадр = 50 и эмулируем вычисление функции-volume.
vi.mock('remotion', () => ({
  useCurrentFrame: () => 50,
  Sequence: ({ children, from }: { children?: React.ReactNode; from?: number }) => (
    <div data-testid={`seq-${from}`}>{children}</div>
  ),
  Audio: ({
    src,
    volume,
    playbackRate,
  }: {
    src?: string;
    volume?: number | ((frame: number) => number);
    playbackRate?: number;
  }) => (
    <audio
      data-testid="audio-node"
      data-src={src}
      data-volume={typeof volume === 'function' ? volume(50) : volume}
      data-rate={playbackRate}
    />
  ),
}));

const cues: Cue<any>[] = [
  { id: 'sfx-1', type: 'sfx', startFrame: 10, payload: { src: 'boom.mp3', volume: 0.5 } },
  { id: 'sfx-2', type: 'sfx', startFrame: 60, payload: { src: 'whoosh.mp3' } },
  { id: 'bgm-1', type: 'music', startFrame: 0, payload: { src: 'bgm.mp3', volume: 0.8 } },
  {
    id: 'vis-1',
    type: 'visual',
    startFrame: 40,
    durationInFrames: 20,
    payload: { text: 'Sticker' },
  },
];

describe('Data-Driven Timeline (Cues)', () => {
  it('useActiveCues фильтрует события по кадру и типу (кадр 50)', () => {
    let active: Cue<any>[] = [];
    let music: Cue<any>[] = [];
    const Probe = () => {
      active = useActiveCues(cues);
      music = useActiveCues(cues, 'music');
      return null;
    };
    render(<Probe />);

    // Кадр 50: sfx-1 (10+), bgm-1 (0+), vis-1 (40..60) активны; sfx-2 (60+) ещё нет.
    expect(active.map((c) => c.id)).toEqual(['sfx-1', 'bgm-1', 'vis-1']);
    expect(music.map((c) => c.id)).toEqual(['bgm-1']);
  });

  it('SFXLayer рендерит только sfx и берёт volume из payload или global', () => {
    const { container } = render(<SFXLayer cues={cues} globalVolume={0.8} />);
    const audios = container.querySelectorAll('audio');

    expect(audios).toHaveLength(2);
    expect(audios[0].getAttribute('data-src')).toBe('boom.mp3');
    expect(audios[0].getAttribute('data-volume')).toBe('0.5');
    expect(audios[1].getAttribute('data-src')).toBe('whoosh.mp3');
    expect(audios[1].getAttribute('data-volume')).toBe('0.8');
  });

  it('SFXLayer пробрасывает playbackRate', () => {
    const withRate: Cue<any>[] = [
      { id: 's', type: 'sfx', startFrame: 0, payload: { src: 'x.mp3', playbackRate: 1.5 } },
    ];
    const { container } = render(<SFXLayer cues={withRate} />);
    expect(container.querySelector('audio')!.getAttribute('data-rate')).toBe('1.5');
  });

  it('MusicLayer применяет ducking-множитель к базовой громкости', () => {
    const ducking = vi.fn((frame: number) => (frame === 50 ? 0.1 : 1));
    const { container } = render(<MusicLayer cues={cues} volumeDucking={ducking} />);
    const audio = container.querySelector('audio')!;

    expect(audio.getAttribute('data-src')).toBe('bgm.mp3');
    // baseVolume (0.8) * duck (0.1) = 0.08
    expect(Number(audio.getAttribute('data-volume'))).toBeCloseTo(0.08);
    expect(ducking).toHaveBeenCalledWith(50);
  });

  it('MusicLayer без ducking играет на базовой громкости', () => {
    const { container } = render(<MusicLayer cues={cues} />);
    expect(Number(container.querySelector('audio')!.getAttribute('data-volume'))).toBeCloseTo(0.8);
  });

  it('TrackLayer рендерит кастомный UI только для своего типа', () => {
    const { getByText, container } = render(
      <TrackLayer
        cues={cues}
        type="visual"
        renderCue={(cue) => <span>{cue.payload.text}</span>}
      />,
    );

    expect(getByText('Sticker')).toBeTruthy();
    expect(container.querySelector('[data-testid="seq-40"]')).toBeTruthy();
    expect(container.querySelectorAll('audio')).toHaveLength(0);
  });
});
