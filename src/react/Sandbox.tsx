import React from 'react';
import { ModuleRegistry, VirtualFileSystem } from '../core/types';
import { SandboxErrorBoundary } from './ErrorBoundary';
import { useLiveSandbox, UseLiveSandboxOptions } from './useLiveSandbox';

export interface SandboxRenderContext {
  Component: React.ComponentType<any> | null;
  error: Error | null;
  isCompiling: boolean;
}

export interface SandboxErrorContext extends SandboxRenderContext {
  error: Error;
  isRuntime?: boolean;
}

export interface SandboxConfig extends UseLiveSandboxOptions {
  /** TSX-код (одиночный файл). */
  code?: string;
  /** Многофайловый вход: путь -> код. */
  files?: VirtualFileSystem;
  /** Модули, доступные через require/import (react добавляется сам). */
  modules?: ModuleRegistry;
  /** Карта ассетов имя -> URL (blob:/data:/http) для staticFile(...). */
  assets?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
  render?: (context: SandboxRenderContext) => React.ReactNode;
  renderLoading?: (context: SandboxRenderContext) => React.ReactNode;
  renderError?: (context: SandboxErrorContext) => React.ReactNode;
}

export interface SandboxProps {
  config: SandboxConfig;
}

const defaultErrorStyle: React.CSSProperties = {
  color: '#ff6b6b',
  whiteSpace: 'pre-wrap',
  fontFamily: 'monospace',
  margin: 0,
  padding: 12,
  background: 'rgba(255, 107, 107, 0.08)',
  borderRadius: 8,
};

/**
 * UI-компонент, который компилирует и рендерит произвольный TSX.
 * Ошибки рендера изолируются внутренним ErrorBoundary.
 */
export const Sandbox: React.FC<SandboxProps> = ({ config }) => {
  const input: string | VirtualFileSystem = config.files ?? config.code ?? '';

  const { Component, error, isCompiling, runtimeError, setRuntimeError } = useLiveSandbox(
    input,
    config.modules ?? {},
    config.assets ?? {},
    config,
  );

  const activeError = runtimeError ?? error;
  const context: SandboxRenderContext = { Component, error: activeError, isCompiling };

  if (config.render) {
    return <>{config.render(context)}</>;
  }

  if (error) {
    if (config.renderError) {
      return <>{config.renderError({ ...context, error, isRuntime: false })}</>;
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

  const rendered = <Component />;
  const wrapped = config.wrapper ? <config.wrapper>{rendered}</config.wrapper> : rendered;

  const content = (
    <SandboxErrorBoundary
      resetKey={input}
      onError={(err) => {
        setRuntimeError(err);
        config.onError?.(err);
      }}
      fallback={(err) =>
        config.renderError ? (
          <>{config.renderError({ ...context, error: err, isRuntime: true })}</>
        ) : (
          <pre style={{ ...defaultErrorStyle, ...config.style }}>{err.message}</pre>
        )
      }
    >
      {wrapped}
    </SandboxErrorBoundary>
  );

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
