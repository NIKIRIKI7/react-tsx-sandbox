export { SandboxFacade } from './facade';
export type { SandboxFacadeOptions } from './facade';

export { useLiveSandbox } from './react/useLiveSandbox';
export type {
  UseLiveSandboxOptions,
  UseLiveSandboxResult,
  CompiledComponentInfo,
} from './react/useLiveSandbox';
export { Sandbox } from './react/Sandbox';
export type {
  SandboxConfig,
  SandboxProps,
  SandboxRenderContext,
  SandboxErrorContext,
} from './react/Sandbox';
export { SandboxErrorBoundary } from './react/ErrorBoundary';
export type { SandboxErrorBoundaryProps } from './react/ErrorBoundary';

export { ModuleCache } from './library-manager/cache';
export { loadMissingModules, defaultCdnResolver, defaultImporter } from './library-manager/loader';
export type { ModuleImporter, LoadModulesOptions } from './library-manager/loader';

export { extractBareImports, scanImports, resolveVfsPath, stripComments } from './compiler/analyzer';
export type { ScanResult } from './compiler/analyzer';
export { compileTsx, SucraseCompilerAdapter, cleanMarkdownFences } from './compiler/transform';
export { injectLoopProtection } from './compiler/loop-protect';
export { getSandboxTypeDefinitions } from './compiler/types-helper';

export { executeComponent } from './sandbox/evaluator';
export type { EvaluatorContext } from './sandbox/evaluator';
export { getShadowedGlobals } from './sandbox/scope';

export { WorkerCompilerAdapter, createCompilerWorker } from './worker/WorkerCompilerAdapter';

export { createRemotionWatchdog } from './sandbox/watchdog';
export type { WatchdogResult, WatchdogHandleInfo } from './sandbox/watchdog';
export { cleanupCanvasWebGl } from './sandbox/webgl-guard';
export { takeContainerSnapshot } from './sandbox/snapshot';
export type { SnapshotOptions } from './sandbox/snapshot';
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

export { extractAssetZip, createAssetUrlMap, releaseAssetUrls } from './assets/zip';
export type { AssetArchive } from './assets/zip';

export * from './core/types';
export * from './core/errors';
