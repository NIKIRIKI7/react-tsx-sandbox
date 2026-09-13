import { Component, ErrorInfo } from 'react';
import type { ReactNode } from 'react';
import { RuntimeRenderError, isSandboxPassthroughError } from '../core/errors';

export interface SandboxErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
  onError?: (error: Error) => void;
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/**
 * Ловит ошибки рендера внутри песочницы, чтобы не ронять хост-приложение.
 * Известные ошибки песочницы (timeout/security) пробрасываются как есть.
 */
export class SandboxErrorBoundary extends Component<SandboxErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const normalized = isSandboxPassthroughError(error)
      ? error
      : new RuntimeRenderError(error, errorInfo.componentStack ?? undefined);

    this.setState({ error: normalized });
    this.props.onError?.(normalized);
  }

  componentDidUpdate(prevProps: SandboxErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error);

      return (
        <pre
          data-testid="runtime-error"
          style={{
            color: '#ff6b6b',
            background: 'rgba(255, 107, 107, 0.08)',
            padding: 12,
            borderRadius: 8,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}
        >
          {this.state.error.message}
        </pre>
      );
    }

    return this.props.children;
  }
}
