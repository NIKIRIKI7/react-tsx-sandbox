import type { ReactNode } from 'react';
import { Audio, Sequence, useCurrentFrame } from 'remotion';

/**
 * Универсальное событие таймлайна. Один и тот же формат описывает
 * звуковые эффекты, музыку, субтитры и визуальные стикеры.
 */
export interface Cue<T = Record<string, unknown>> {
  id: string | number;
  type: string;
  startFrame: number;
  durationInFrames?: number;
  payload: T;
}

/** Данные аудио-событий (SFX и музыка). */
export interface AudioPayload {
  src: string;
  volume?: number;
  playbackRate?: number;
}

export type SFXPayload = AudioPayload;

/** Возвращает события, активные на текущем кадре (опционально — только заданного типа). */
export function useActiveCues<T = Record<string, unknown>>(
  cues: Cue<T>[],
  type?: string,
): Cue<T>[] {
  const frame = useCurrentFrame();
  return cues.filter((cue) => {
    if (type && cue.type !== type) return false;
    if (frame < cue.startFrame) return false;
    if (cue.durationInFrames !== undefined && frame >= cue.startFrame + cue.durationInFrames) {
      return false;
    }
    return true;
  });
}

export interface SFXLayerProps {
  cues: Cue<AudioPayload>[];
  /** Громкость по умолчанию для событий без собственного `payload.volume`. */
  globalVolume?: number;
}

/** Рендерит все события `type: 'sfx'` как `<Sequence><Audio /></Sequence>`. */
export function SFXLayer({ cues, globalVolume = 1 }: SFXLayerProps) {
  const sfx = cues.filter((cue) => cue.type === 'sfx');

  return (
    <>
      {sfx.map((cue) => {
        const volume = cue.payload.volume !== undefined ? cue.payload.volume : globalVolume;
        return (
          <Sequence key={cue.id} from={cue.startFrame} durationInFrames={cue.durationInFrames}>
            <Audio
              src={cue.payload.src}
              volume={volume}
              playbackRate={cue.payload.playbackRate ?? 1}
            />
          </Sequence>
        );
      })}
    </>
  );
}

export interface MusicLayerProps {
  cues: Cue<AudioPayload>[];
  /**
   * Множитель громкости (0..1) как функция от кадра — используется для
   * Audio Ducking: музыка приглушается, пока идёт озвучка.
   */
  volumeDucking?: (frame: number) => number;
}

/** Рендерит фоновую музыку с поддержкой покадрового ducking'а громкости. */
export function MusicLayer({ cues, volumeDucking }: MusicLayerProps) {
  const music = cues.filter((cue) => cue.type === 'music');

  return (
    <>
      {music.map((cue) => {
        const baseVolume = cue.payload.volume ?? 1;
        const volume = (frame: number) => baseVolume * (volumeDucking ? volumeDucking(frame) : 1);
        return (
          <Sequence key={cue.id} from={cue.startFrame} durationInFrames={cue.durationInFrames}>
            <Audio
              src={cue.payload.src}
              volume={volume}
              playbackRate={cue.payload.playbackRate ?? 1}
            />
          </Sequence>
        );
      })}
    </>
  );
}

export interface TrackLayerProps<T> {
  cues: Cue<T>[];
  /** Тип событий, которые нужно отрендерить (например, `'sticker'`). */
  type: string;
  renderCue: (cue: Cue<T>) => ReactNode;
}

/** Универсальный визуальный слой: тайминг берёт на себя `<Sequence>`, контент — `renderCue`. */
export function TrackLayer<T>({ cues, type, renderCue }: TrackLayerProps<T>) {
  const tracks = cues.filter((cue) => cue.type === type);

  return (
    <>
      {tracks.map((cue) => (
        <Sequence key={cue.id} from={cue.startFrame} durationInFrames={cue.durationInFrames}>
          {renderCue(cue)}
        </Sequence>
      ))}
    </>
  );
}
