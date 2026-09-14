import { createContext, useContext } from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { PlayerRef } from '@remotion/player';
import type { SnapshotOptions } from '../../sandbox/snapshot';
import type { BrowserExportCodec, ExportProgress, ExportQuality } from '../../export/browser-export';

export interface ExportVideoOptions {
  /** Имя файла для автозагрузки. `filename: false` — только вернуть Blob. */
  filename?: string | false;
  /** `avc` — MP4 (по умолчанию), `vp8`/`vp9` — WebM. */
  codec?: BrowserExportCodec;
  /** Пресет качества. По умолчанию `'high'`. */
  quality?: ExportQuality;
  /** Явный битрейт в битах/с (приоритетнее `quality`). */
  bitrate?: number;
  /** Переопределить ширину кадра (по умолчанию — размер композиции). */
  width?: number;
  /** Переопределить высоту кадра (по умолчанию — размер композиции). */
  height?: number;
  /** Переопределить fps (по умолчанию — fps композиции). */
  fps?: number;
  /** Прогресс экспорта: `capturing → encoding → muxing → done`. */
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportState {
  isExporting: boolean;
  progress: number | null;
  phase: string | null;
  error: Error | null;
}

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
  exportState: ExportState;
  getExportState: () => ExportState;
  exportVideo: (options?: ExportVideoOptions) => Promise<Blob | null>;
  abortExport: () => void;
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
