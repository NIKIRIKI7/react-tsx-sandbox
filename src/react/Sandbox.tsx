import React from 'react';
import { useLiveSandbox, CompiledComponentInfo, UseLiveSandboxOptions } from './useLiveSandbox';
import { ModuleRegistry } from '../core/types';
import { ModuleImporter } from '../library-manager/loader';

export interface SandboxRenderContext {
  Component: React.ComponentType<any> | null;
  error: Error | null;
  isCompiling: boolean;
}

export interface SandboxErrorContext extends SandboxRenderContext {
  error: Error;
}

/**
 * Конфигурационный объект песочницы. Всё опционально, кроме `code`.
 * Компонент можно кастомизировать слотами (`render`, `renderLoading`,
 * `renderError`, `wrapper`) и контейнером (`className`, `style`).
 */
export interface SandboxConfig {
  /** TSX-код для компиляции и рендера. */
  code: string;
  /** Модули, доступные через `require`/`import` (react добавляется сам). */
  modules?: ModuleRegistry;
  /** Карта ассетов `имя -> URL` (blob:/data:/http) для `staticFile(...)`. */
  assets?: Record<string, string>;
  /** Кастомный загрузчик npm-пакетов (по умолчанию — esm.sh). */
  importer?: ModuleImporter;
  /** Классы контейнера. При наличии `className`/`style` контент оборачивается в `div`. */
  className?: string;
  /** Инлайн-стили контейнера. */
  style?: React.CSSProperties;
  /** Обёртка вокруг готового компонента. */
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
  /** Полный контроль над рендером (перекрывает остальные слоты). */
  render?: (context: SandboxRenderContext) => React.ReactNode;
  /** Рендер состояния загрузки (по умолчанию `null`). */
  renderLoading?: (context: SandboxRenderContext) => React.ReactNode;
  /** Рендер ошибки (по умолчанию сообщение в `<pre>`). */
  renderError?: (context: SandboxErrorContext) => React.ReactNode;
  /** Колбэк ошибки компиляции/загрузки. */
  onError?: (error: Error) => void;
  /** Колбэк успешной компиляции. */
  onCompiled?: (info: CompiledComponentInfo) => void;
}

export interface SandboxProps {
  config: SandboxConfig;
}

const defaultErrorStyle: React.CSSProperties = {
  color: '#ff6b6b',
  whiteSpace: 'pre-wrap',
  fontFamily: 'monospace',
  margin: 0,
};

/**
 * UI-компонент, который компилирует и рендерит произвольный TSX.
 *
 * ```tsx
 * import { Sandbox } from 'browser-tsx-sandbox';
 *
 * <Sandbox config={{ code: userTsx, className: 'preview', renderLoading: () => <Spinner /> }} />
 * ```
 */
export const Sandbox: React.FC<SandboxProps> = ({ config }) => {
  const { Component, error, isCompiling } = useLiveSandbox(
    config.code,
    config.modules ?? {},
    config.assets ?? {},
    {
      importer: config.importer,
      onError: config.onError,
      onCompiled: config.onCompiled,
    } satisfies UseLiveSandboxOptions,
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

  const content = config.wrapper ? <config.wrapper>{<Component />}</config.wrapper> : <Component />;

  if (config.className || config.style) {
    return (
      <div className={config.className} style={config.style} data-tsx-sandbox="">
        {content}
      </div>
    );
  }

  return <>{content}</>;
};

Sandbox.displayName = 'Sandbox';
