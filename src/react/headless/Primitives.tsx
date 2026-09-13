import type { ButtonHTMLAttributes, ChangeEvent, CSSProperties, ReactNode } from 'react';
import { usePlayerContext } from './PlayerContext';

/** Состояние, передаваемое в render prop кнопки Play/Pause. */
export interface PlayPauseButtonRenderProps {
  isPlaying: boolean;
  toggle: () => void;
}

export type PlayPauseButtonChildren =
  | ReactNode
  | ((context: PlayPauseButtonRenderProps) => ReactNode);

export interface PlayPauseButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /**
   * Render prop для полного контроля над разметкой (Radix, MUI, Tailwind...).
   * При передаче функции стандартная `<button>` не рендерится.
   */
  children?: PlayPauseButtonChildren;
}

export function PlayPauseButton({ children, onClick, ...props }: PlayPauseButtonProps) {
  const { isPlaying, toggle } = usePlayerContext();

  if (typeof children === 'function') {
    return <>{children({ isPlaying, toggle })}</>;
  }

  return (
    <button
      type="button"
      data-testid="player-play-button"
      onClick={(event) => {
        toggle();
        onClick?.(event);
      }}
      {...props}
    >
      {children ?? (isPlaying ? '❚❚' : '▶')}
    </button>
  );
}

function formatTimecode(frame: number, fps: number): string {
  const totalSeconds = Math.floor(frame / (fps || 30));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Состояние, передаваемое в render prop счётчика времени. */
export interface TimeDisplayRenderProps {
  frame: number;
  totalFrames: number;
  time: string;
  totalTime: string;
  fps: number;
}

export interface TimeDisplayProps {
  format?: 'frames' | 'time' | 'both';
  className?: string;
  style?: CSSProperties;
  /** Render prop для кастомного форматирования времени. */
  render?: (context: TimeDisplayRenderProps) => ReactNode;
}

export function TimeDisplay({ format = 'both', className, style, render }: TimeDisplayProps) {
  const { currentFrame, durationInFrames, fps } = usePlayerContext();

  if (render) {
    return (
      <>
        {render({
          frame: currentFrame,
          totalFrames: durationInFrames,
          time: formatTimecode(currentFrame, fps),
          totalTime: formatTimecode(durationInFrames, fps),
          fps,
        })}
      </>
    );
  }

  const content =
    format === 'frames'
      ? `${currentFrame} / ${durationInFrames}f`
      : format === 'time'
        ? `${formatTimecode(currentFrame, fps)} / ${formatTimecode(durationInFrames, fps)}`
        : `${formatTimecode(currentFrame, fps)} (${currentFrame}f) / ${formatTimecode(durationInFrames, fps)}`;

  return (
    <span
      data-testid="player-time-display"
      className={className}
      style={{ fontFamily: 'ui-monospace, Consolas, monospace', ...style }}
    >
      {content}
    </span>
  );
}

/** Состояние, передаваемое в render prop таймлайна. */
export interface TimelineBarRenderProps {
  currentFrame: number;
  durationInFrames: number;
  seekTo: (frame: number) => void;
}

export interface TimelineBarProps {
  className?: string;
  style?: CSSProperties;
  /** Render prop для кастомного ползунка (Radix Slider, дорожки и т.п.). */
  render?: (context: TimelineBarRenderProps) => ReactNode;
}

export function TimelineBar({ className, style, render }: TimelineBarProps) {
  const { currentFrame, durationInFrames, seekTo } = usePlayerContext();

  if (render) {
    return <>{render({ currentFrame, durationInFrames, seekTo })}</>;
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    seekTo(Number(event.target.value));
  };

  return (
    <div
      data-testid="player-timeline"
      className={className}
      style={{ display: 'flex', alignItems: 'center', width: '100%', ...style }}
    >
      <input
        type="range"
        min={0}
        max={Math.max(0, durationInFrames - 1)}
        value={currentFrame}
        onChange={handleChange}
        style={{ width: '100%', cursor: 'pointer' }}
      />
    </div>
  );
}

/** Состояние, передаваемое в render prop регулятора громкости. */
export interface VolumeControlRenderProps {
  volume: number;
  isMuted: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

export interface VolumeControlProps {
  className?: string;
  style?: CSSProperties;
  /** Render prop для кастомного контрола громкости. */
  render?: (context: VolumeControlRenderProps) => ReactNode;
}

export function VolumeControl({ className, style, render }: VolumeControlProps) {
  const { volume, setVolume, isMuted, toggleMute } = usePlayerContext();

  if (render) {
    return <>{render({ volume, isMuted, setVolume, toggleMute })}</>;
  }

  return (
    <div
      data-testid="player-volume-control"
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}
    >
      <button type="button" data-testid="player-mute-button" onClick={toggleMute}>
        {isMuted || volume === 0 ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        data-testid="player-volume-slider"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
      />
    </div>
  );
}
