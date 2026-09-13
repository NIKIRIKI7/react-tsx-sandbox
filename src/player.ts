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
} from './react/headless/Primitives';

export { takeContainerSnapshot } from './sandbox/snapshot';
export type { SnapshotOptions } from './sandbox/snapshot';
export { createRemotionWatchdog } from './sandbox/watchdog';
export type { WatchdogResult, WatchdogHandleInfo } from './sandbox/watchdog';
export { cleanupCanvasWebGl } from './sandbox/webgl-guard';
