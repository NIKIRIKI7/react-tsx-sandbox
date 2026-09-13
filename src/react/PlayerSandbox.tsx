import React from 'react';
import { Player } from '@remotion/player';
import type { PlayerPropsWithoutZod } from '@remotion/player';
import { useLiveSandbox } from './useLiveSandbox';
import { SandboxConfig, SandboxRenderContext } from './Sandbox';

/**
 * Конфиг live-preview плеера: обычный `SandboxConfig` + параметры Remotion Player.
 * Требуется установленный `@remotion/player` (peer, опционально).
 */
export interface PlayerSandboxConfig extends SandboxConfig {
  /** Длительность в кадрах. По умолчанию 300. */
  durationInFrames?: number;
  /** Частота кадров. По умолчанию 30. */
  fps?: number;
  /** Ширина композиции. По умолчанию 1920. */
  width?: number;
  /** Высота композиции. По умолчанию 1080. */
  height?: number;
  /** Показывать элементы управления (play/seek). По умолчанию `true`. */
  controls?: boolean;
  /** Зациклить воспроизведение. */
  loop?: boolean;
  /** Автозапуск при монтировании. */
  autoPlay?: boolean;
  /** Пропсы, передаваемые в скомпилированный компонент. */
  inputProps?: Record<string, unknown>;
  /** Escape hatch: любые дополнительные пропсы `<Player />`. */
  playerProps?: Partial<PlayerPropsWithoutZod<Record<string, unknown>>>;
}

export interface PlayerSandboxProps {
  config: PlayerSandboxConfig;
}

const defaultErrorStyle: React.CSSProperties = {
  color: '#ff6b6b',
  whiteSpace: 'pre-wrap',
  fontFamily: 'monospace',
  margin: 0,
};

/**
 * UI-компонент мгновенного предпросмотра: компилирует TSX и показывает его
 * в `<Player>` с play/pause/seek — без серверного рендера.
 *
 * ```tsx
 * import { PlayerSandbox } from 'browser-tsx-sandbox/player';
 *
 * <PlayerSandbox config={{ code, durationInFrames: 300, fps: 30, controls: true }} />
 * ```
 */
export const PlayerSandbox: React.FC<PlayerSandboxProps> = ({ config }) => {
  const { Component, error, isCompiling } = useLiveSandbox(
    config.code,
    config.modules ?? {},
    config.assets ?? {},
    {
      importer: config.importer,
      onError: config.onError,
      onCompiled: config.onCompiled,
    },
  );

  const context: SandboxRenderContext = { Component, error, isCompiling };

  if (config.render) {
    return <>{config.render(context)}</>;
  }

  if (error) {
    if (config.renderError) {
      return <>{config.renderError({ ...context, error })}</>;
    }
    return (
      <pre className={config.className} style={{ ...defaultErrorStyle, ...config.style }}>
        {error.message}
      </pre>
    );
  }

  if (isCompiling || !Component) {
    return config.renderLoading ? <>{config.renderLoading(context)}</> : null;
  }

  const player = (
    <Player
      component={Component}
      durationInFrames={config.durationInFrames ?? 300}
      fps={config.fps ?? 30}
      compositionWidth={config.width ?? 1920}
      compositionHeight={config.height ?? 1080}
      controls={config.controls ?? true}
      loop={config.loop}
      autoPlay={config.autoPlay}
      inputProps={config.inputProps}
      className={config.className}
      style={config.style}
      {...config.playerProps}
    />
  );

  return <>{config.wrapper ? <config.wrapper>{player}</config.wrapper> : player}</>;
};

PlayerSandbox.displayName = 'PlayerSandbox';
