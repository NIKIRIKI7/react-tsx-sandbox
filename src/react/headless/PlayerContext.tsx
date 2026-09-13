import { createContext, useContext } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { PlayerRef } from '@remotion/player';
import type { SnapshotOptions } from '../../sandbox/snapshot';

export interface PlayerContextValue {
  playerRef: RefObject<PlayerRef | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  currentFrame: number;
  durationInFrames: number;
  fps: number;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  zoom: number;
  pan: { x: number; y: number };
  seekTo: (frame: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  resetZoomPan: () => void;
  takeSnapshot: (options?: SnapshotOptions) => Promise<string>;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayerContext(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayerContext должен использоваться внутри <PlayerSandbox.Root>');
  }
  return context;
}

export interface StudioLayoutProps {
  className?: string;
  style?: CSSProperties;
}
