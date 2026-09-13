import type { ButtonHTMLAttributes, ChangeEvent, CSSProperties } from 'react';
import { usePlayerContext } from './PlayerContext';

export function PlayPauseButton({
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { isPlaying, toggle } = usePlayerContext();

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

export interface TimeDisplayProps {
  format?: 'frames' | 'time' | 'both';
  className?: string;
  style?: CSSProperties;
}

export function TimeDisplay({ format = 'both', className, style }: TimeDisplayProps) {
  const { currentFrame, durationInFrames, fps } = usePlayerContext();

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

export interface TimelineBarProps {
  className?: string;
  style?: CSSProperties;
}

export function TimelineBar({ className, style }: TimelineBarProps) {
  const { currentFrame, durationInFrames, seekTo } = usePlayerContext();

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

export function VolumeControl({ className, style }: { className?: string; style?: CSSProperties }) {
  const { volume, setVolume, isMuted, toggleMute } = usePlayerContext();

  return (
    <div
      data-testid="player-volume-control"
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}
    >
      <button type="button" data-testid="player-mute-button" onClick={toggleMute}>
        {isMuted ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
      />
    </div>
  );
}
