import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Player } from '@remotion/player';
import type { PlayerPropsWithoutZod, PlayerRef } from '@remotion/player';
import { SandboxConfig, SandboxRenderContext } from './Sandbox';
import { SandboxErrorBoundary } from './ErrorBoundary';
import { useLiveSandbox } from './useLiveSandbox';
import { createRemotionWatchdog } from '../sandbox/watchdog';
import { cleanupCanvasWebGl } from '../sandbox/webgl-guard';
import { takeContainerSnapshot } from '../sandbox/snapshot';
import type { SnapshotOptions } from '../sandbox/snapshot';
import { SafeZonesOverlay } from './guides/SafeZonesOverlay';
import type { SafeZonePreset } from './guides/SafeZonesOverlay';
import { PlayerContext, PlayerContextValue } from './headless/PlayerContext';
import type { ExportState, ExportVideoOptions } from './headless/PlayerContext';
import { downloadExportBlob, exportBrowserVideo } from '../export/browser-export';
import {
  ExportButton,
  PlayPauseButton,
  TimeDisplay,
  TimelineBar,
  VolumeControl,
} from './headless/Primitives';

export interface CanvasControlsConfig {
  enabled?: boolean;
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
}

export interface PlayerSandboxConfig extends SandboxConfig {
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
  controls?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  inputProps?: Record<string, unknown>;
  playerProps?: Partial<PlayerPropsWithoutZod<Record<string, unknown>>>;
  /** Сохранять текущий кадр при перекомпиляции (по умолчанию true). */
  smartFrameRetention?: boolean;
  /** Таймаут `delayRender` в ms (по умолчанию 4000). */
  delayRenderTimeoutMs?: number;
  /** Оверлей безопасных зон (TikTok/Reels/Shorts, TV-safe, rule-of-thirds). */
  safeZone?: SafeZonePreset | SafeZonePreset[];
  /** Зум и панорамирование холста. */
  canvasControls?: CanvasControlsConfig;
}

export interface PlayerSandboxProps {
  config: PlayerSandboxConfig;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface PlayerSandboxRef {
  seekTo: (frame: number) => void;
  getCurrentFrame: () => number;
  isPlaying: () => boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  takeSnapshot: (options?: SnapshotOptions) => Promise<string>;
  getActiveDelayHandles: () => string[];
  getRemotionPlayerRef: () => PlayerRef | null;
  resetZoomPan: () => void;
  /** Программный экспорт видео (MP4/WebM). */
  exportVideo: (options?: ExportVideoOptions) => Promise<Blob | null>;
  abortExport: () => void;
}

const defaultErrorStyle: React.CSSProperties = {
  color: '#ff6b6b',
  whiteSpace: 'pre-wrap',
  fontFamily: 'monospace',
  margin: 0,
  padding: 12,
};

export const PlayerSandboxComponent = forwardRef<PlayerSandboxRef, PlayerSandboxProps>(
  ({ config, className, style, children }, ref) => {
    const input = config.files ?? config.code ?? '';
    const internalPlayerRef = useRef<PlayerRef | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const currentFrameRef = useRef(0);
    const wasPlayingRef = useRef(false);

    const [currentFrame, setCurrentFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(config.autoPlay ?? false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolumeState] = useState(1);
    const [zoom, setZoom] = useState(config.canvasControls?.initialZoom ?? 1);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [exportState, setExportState] = useState<ExportState>({
      isExporting: false,
      progress: null,
      phase: null,
      error: null,
    });
    const abortExportRef = useRef<AbortController | null>(null);

    const isPanningRef = useRef(false);
    const startMouseRef = useRef({ x: 0, y: 0 });

    const { proxiedRemotion, getActiveHandles, clearAllTimeouts } = useMemo(
      () => createRemotionWatchdog(config.modules?.remotion, config.delayRenderTimeoutMs ?? 4000),
      [config.modules?.remotion, config.delayRenderTimeoutMs],
    );

    const proxiedModules = useMemo(() => {
      if (!config.modules?.remotion) return config.modules ?? {};
      return { ...config.modules, remotion: proxiedRemotion };
    }, [config.modules, proxiedRemotion]);

    const { Component, error, isCompiling, runtimeError, setRuntimeError } = useLiveSandbox(
      input,
      proxiedModules,
      config.assets ?? {},
      config,
    );

    // Актуальная конфигурация для использования внутри мемоизированных замыканий
    const configRef = useRef(config);
    configRef.current = config;

    // Мемоизируем SafeComponent, чтобы избежать ре-маунта <Player> на каждом обновлении состояния (time/play)
    const SafeComponent: React.FC<Record<string, unknown>> = useMemo(() => {
      if (!Component) return () => null;
      const Wrapped: React.FC<Record<string, unknown>> = (props) => (
        <SandboxErrorBoundary
          resetKey={input}
          onError={(err) => {
            setRuntimeError(err);
            configRef.current.onError?.(err);
          }}
          fallback={(err) =>
            configRef.current.renderError ? (
              <>{configRef.current.renderError({ Component, error: err, isCompiling: false, isRuntime: true })}</>
            ) : (
              <div style={{ ...defaultErrorStyle, padding: 16 }}>{err.message}</div>
            )
          }
        >
          <Component {...props} />
        </SandboxErrorBoundary>
      );
      Wrapped.displayName = 'SafeComponent';
      return Wrapped;
    }, [Component, input, setRuntimeError]);

    useEffect(() => {
      if (config.smartFrameRetention === false) return;
      const player = internalPlayerRef.current;
      if (!Component || !player) return;

      player.seekTo(currentFrameRef.current);
      if (wasPlayingRef.current) player.play();
    }, [Component, config.smartFrameRetention]);

    useEffect(() => {
      return () => {
        clearAllTimeouts();
        cleanupCanvasWebGl(containerRef.current);
      };
    }, [clearAllTimeouts]);

    useEffect(() => {
      const player = internalPlayerRef.current;
      if (!player) return;

      const onFrameUpdate = (event: { detail?: { frame?: number } }) => {
        const frame = event.detail?.frame ?? player.getCurrentFrame();
        currentFrameRef.current = frame;
        setCurrentFrame(frame);
      };

      const onPlay = () => {
        wasPlayingRef.current = true;
        setIsPlaying(true);
      };

      const onPause = () => {
        wasPlayingRef.current = false;
        setIsPlaying(false);
      };

      player.addEventListener('frameupdate', onFrameUpdate as never);
      player.addEventListener('play', onPlay);
      player.addEventListener('pause', onPause);

      return () => {
        player.removeEventListener('frameupdate', onFrameUpdate as never);
        player.removeEventListener('play', onPlay);
        player.removeEventListener('pause', onPause);
      };
    }, [Component]);

    const handleWheel = useCallback(
      (event: React.WheelEvent) => {
        if (!config.canvasControls?.enabled) return;
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          const delta = event.deltaY > 0 ? -0.1 : 0.1;
          const min = config.canvasControls.minZoom ?? 0.25;
          const max = config.canvasControls.maxZoom ?? 4;
          setZoom((prev) => Math.min(max, Math.max(min, Number((prev + delta).toFixed(2)))));
        }
      },
      [config.canvasControls],
    );

    const handleMouseDown = useCallback(
      (event: React.MouseEvent) => {
        if (!config.canvasControls?.enabled) return;
        if (event.button === 1 || event.shiftKey) {
          isPanningRef.current = true;
          startMouseRef.current = { x: event.clientX - pan.x, y: event.clientY - pan.y };
        }
      },
      [config.canvasControls, pan],
    );

    const handleMouseMove = useCallback((event: React.MouseEvent) => {
      if (!isPanningRef.current) return;
      setPan({ x: event.clientX - startMouseRef.current.x, y: event.clientY - startMouseRef.current.y });
    }, []);

    const handleMouseUp = useCallback(() => {
      isPanningRef.current = false;
    }, []);

    const resetZoomPan = useCallback(() => {
      setZoom(config.canvasControls?.initialZoom ?? 1);
      setPan({ x: 0, y: 0 });
    }, [config.canvasControls?.initialZoom]);

    const seekTo = useCallback((frame: number) => {
      internalPlayerRef.current?.seekTo(frame);
      currentFrameRef.current = frame;
      setCurrentFrame(frame);
    }, []);

    const play = useCallback(() => internalPlayerRef.current?.play(), []);
    const pause = useCallback(() => internalPlayerRef.current?.pause(), []);
    const toggle = useCallback(() => internalPlayerRef.current?.toggle(), []);
    const setVolume = useCallback((value: number) => {
      setVolumeState(value);
      internalPlayerRef.current?.setVolume(value);
    }, []);
    const toggleMute = useCallback(() => {
      setIsMuted((prev) => {
        if (prev) internalPlayerRef.current?.unmute();
        else internalPlayerRef.current?.mute();
        return !prev;
      });
    }, []);
    const takeSnapshot = useCallback(
      (options?: SnapshotOptions) => takeContainerSnapshot(containerRef.current, options),
      [],
    );

    const abortExport = useCallback(() => {
      abortExportRef.current?.abort();
    }, []);

    const exportVideo = useCallback(
      async (options: ExportVideoOptions = {}): Promise<Blob | null> => {
        const container = containerRef.current;
        if (!container || (abortExportRef.current && !abortExportRef.current.signal.aborted)) return null;

        const controller = new AbortController();
        abortExportRef.current = controller;

        setExportState({ isExporting: true, progress: 0, phase: 'capturing', error: null });

        try {
          const currentConfig = configRef.current;
          const blob = await exportBrowserVideo({
            container,
            durationInFrames: currentConfig.durationInFrames ?? 300,
            fps: currentConfig.fps ?? 30,
            width: currentConfig.width ?? 1920,
            height: currentConfig.height ?? 1080,
            seekTo,
            codec: options.codec ?? 'avc',
            quality: options.quality ?? 'high',
            bitrate: options.bitrate,
            signal: controller.signal,
            onProgress: (next) =>
              setExportState({ isExporting: true, progress: next.progress, phase: next.phase, error: null }),
          });

          if (options.filename !== false) {
            downloadExportBlob(blob, options.filename);
          }

          setExportState({ isExporting: false, progress: 1, phase: 'done', error: null });
          return blob;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          setExportState({ isExporting: false, progress: null, phase: null, error: err });
          return null;
        } finally {
          abortExportRef.current = null;
        }
      },
      [seekTo],
    );

    useImperativeHandle(
      ref,
      () => ({
        seekTo,
        getCurrentFrame: () => internalPlayerRef.current?.getCurrentFrame() ?? currentFrameRef.current,
        isPlaying: () => internalPlayerRef.current?.isPlaying() ?? false,
        play,
        pause,
        toggle,
        takeSnapshot,
        getActiveDelayHandles: () => getActiveHandles().map((handle) => handle.label ?? `handle_${handle.id}`),
        getRemotionPlayerRef: () => internalPlayerRef.current,
        resetZoomPan,
        exportVideo,
        abortExport,
      }),
      [getActiveHandles, resetZoomPan, seekTo, play, pause, toggle, takeSnapshot, exportVideo, abortExport],
    );

    const activeError = runtimeError ?? error;
    const context: SandboxRenderContext = { Component, error: activeError, isCompiling };

    const contextValue: PlayerContextValue = useMemo(() => ({
      playerRef: internalPlayerRef,
      containerRef,
      currentFrame,
      durationInFrames: config.durationInFrames ?? 300,
      fps: config.fps ?? 30,
      isPlaying,
      isMuted,
      volume,
      zoom,
      pan,
      seekTo,
      play,
      pause,
      toggle,
      setVolume,
      toggleMute,
      setZoom,
      setPan,
      resetZoomPan,
      takeSnapshot,
      exportState,
      exportVideo,
      abortExport,
    }), [
      currentFrame,
      config.durationInFrames,
      config.fps,
      isPlaying,
      isMuted,
      volume,
      zoom,
      pan,
      seekTo,
      play,
      pause,
      toggle,
      setVolume,
      toggleMute,
      resetZoomPan,
      takeSnapshot,
      exportState,
      exportVideo,
      abortExport,
    ]);

    let contentNode: React.ReactNode;

    if (config.render) {
      contentNode = <>{config.render(context)}</>;
    } else if (error) {
      if (config.renderError) {
        contentNode = <>{config.renderError({ ...context, error, isRuntime: false })}</>;
      } else {
        contentNode = <pre style={{ ...defaultErrorStyle, ...config.style }}>{error.message}</pre>;
      }
    } else if (isCompiling || !Component) {
      contentNode = config.renderLoading ? <>{config.renderLoading(context)}</> : null;
    } else {
      const playerElement = (
        <div
          ref={containerRef}
          data-testid="player-container"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            height: '100%',
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          <Player
            ref={internalPlayerRef}
            component={SafeComponent}
            durationInFrames={config.durationInFrames ?? 300}
            fps={config.fps ?? 30}
            compositionWidth={config.width ?? 1920}
            compositionHeight={config.height ?? 1080}
            controls={config.controls ?? true}
            loop={config.loop}
            autoPlay={config.autoPlay}
            inputProps={config.inputProps}
            className={config.className}
            style={{
              width: '100%',
              height: '100%',
              ...config.style,
            }}
            {...config.playerProps}
          />
          {config.safeZone ? <SafeZonesOverlay preset={config.safeZone} /> : null}
        </div>
      );
      contentNode = config.wrapper ? <config.wrapper>{playerElement}</config.wrapper> : playerElement;
    }

    return (
      <PlayerContext.Provider value={contextValue}>
        <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
          {contentNode}
          {children}
        </div>
      </PlayerContext.Provider>
    );
  },
);

PlayerSandboxComponent.displayName = 'PlayerSandbox';

export const PlayerSandbox = Object.assign(PlayerSandboxComponent, {
  Root: PlayerSandboxComponent,
  PlayButton: PlayPauseButton,
  TimeDisplay,
  Timeline: TimelineBar,
  VolumeControl,
  ExportButton,
  Guides: SafeZonesOverlay,
});