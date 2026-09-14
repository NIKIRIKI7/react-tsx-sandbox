export { PlayerSandbox } from './react/PlayerSandbox';
export type {
  PlayerSandboxConfig,
  PlayerSandboxProps,
  PlayerSandboxRef,
  CanvasControlsConfig,
} from './react/PlayerSandbox';

export { SafeZonesOverlay } from './react/guides/SafeZonesOverlay';
export type { SafeZonesOverlayProps, SafeZonePreset } from './react/guides/SafeZonesOverlay';

export { PlayerContext, usePlayerContext } from './react/headless/PlayerContext';
export type { PlayerContextValue } from './react/headless/PlayerContext';
export {
  PlayPauseButton,
  TimeDisplay,
  TimelineBar,
  VolumeControl,
  ExportButton,
} from './react/headless/Primitives';
export type {
  PlayPauseButtonProps,
  PlayPauseButtonRenderProps,
  TimeDisplayProps,
  TimeDisplayRenderProps,
  TimelineBarProps,
  TimelineBarRenderProps,
  VolumeControlProps,
  VolumeControlRenderProps,
  ExportButtonProps,
  ExportButtonRenderProps,
} from './react/headless/Primitives';

export {
  exportBrowserVideo,
  downloadExportBlob,
  supportsBrowserExport,
  muxWebm,
} from './export/browser-export';
export type {
  BrowserExportOptions,
  BrowserExportCodec,
  ExportProgress,
} from './export/browser-export';

export { takeContainerSnapshot } from './sandbox/snapshot';
export type { SnapshotOptions } from './sandbox/snapshot';
export { createRemotionWatchdog } from './sandbox/watchdog';
export type { WatchdogResult, WatchdogHandleInfo } from './sandbox/watchdog';
export { cleanupCanvasWebGl } from './sandbox/webgl-guard';
