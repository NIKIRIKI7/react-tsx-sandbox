export type ErrorPhase = 'compiler' | 'security' | 'network' | 'runtime' | 'timeout';

export class CompilerError extends Error {
  readonly name = 'CompilerError';
  readonly line?: number;
  readonly column?: number;
  readonly snippet?: string;

  constructor(message: string, line?: number, column?: number, snippet?: string) {
    const loc = line !== undefined ? ` (${line}:${column ?? 0})` : '';
    super(`[Compiler Error]${loc}: ${message}`);
    this.line = line;
    this.column = column;
    this.snippet = snippet;
  }
}

export class SecurityError extends Error {
  readonly name = 'SecurityError';

  constructor(message: string) {
    super(`[Security Violation]: ${message}`);
  }
}

export class NetworkModuleError extends Error {
  readonly name = 'NetworkModuleError';
  readonly moduleName: string;

  constructor(moduleName: string, originalMessage: string) {
    super(`[Network Error]: Не удалось загрузить пакет "${moduleName}". ${originalMessage}`);
    this.moduleName = moduleName;
  }
}

export class ExecutionTimeoutError extends Error {
  readonly name = 'ExecutionTimeoutError';
  readonly limit: number;

  constructor(limit: number, type: 'iterations' | 'time' = 'iterations') {
    const what = type === 'iterations' ? `${limit} итераций` : `${limit}ms`;
    super(`[Infinite Loop Protection]: Превышен лимит ${what}. Выполнение прервано.`);
    this.limit = limit;
  }
}

export class RuntimeRenderError extends Error {
  readonly name = 'RuntimeRenderError';
  readonly componentStack?: string;
  readonly cause?: Error;

  constructor(originalError: Error, componentStack?: string) {
    super(`[Runtime Render Error]: ${originalError.message}`);
    this.cause = originalError;
    this.componentStack = componentStack;
  }
}

export function isExecutionTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExecutionTimeoutError';
}

export function isSandboxPassthroughError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ExecutionTimeoutError' ||
      error.name === 'SecurityError' ||
      error.name === 'NetworkModuleError')
  );
}

export function getErrorPhase(error: unknown): ErrorPhase {
  const name = error instanceof Error ? error.name : '';
  if (name === 'SecurityError') return 'security';
  if (name === 'NetworkModuleError') return 'network';
  if (name === 'ExecutionTimeoutError') return 'timeout';
  if (name === 'RuntimeRenderError') return 'runtime';
  if (name === 'AbortError') return 'runtime';
  if (error instanceof Error && error.message.startsWith('[Runtime Error]')) return 'runtime';
  return 'compiler';
}
