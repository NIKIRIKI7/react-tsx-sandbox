export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  /** Включить вывод в консоль. По умолчанию `false`. */
  enabled?: boolean;
  /** Порог вывода: логи уровня ниже не печатаются. По умолчанию `'debug'`. */
  level?: LogLevel;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const state: { enabled: boolean; level: LogLevel } = {
  enabled: false,
  level: 'debug',
};

/** Управляет глобальным логгером библиотеки (работает и в браузере, и в SSR/Node). */
export function configureLogger(options: LoggerOptions): void {
  if (typeof options.enabled === 'boolean') {
    state.enabled = options.enabled;
  }
  if (options.level) {
    state.level = options.level;
  }
}

function shouldLog(level: LogLevel): boolean {
  return state.enabled && LEVEL_ORDER[level] >= LEVEL_ORDER[state.level];
}

function write(level: LogLevel, args: readonly unknown[]): void {
  if (!shouldLog(level)) return;
  const method: 'debug' | 'info' | 'warn' | 'error' = level === 'debug' ? 'debug' : level;
  const target = globalThis.console;
  if (target && typeof target[method] === 'function') {
    target[method](`[browser-tsx-sandbox:${level}]`, ...args);
  }
}

export const logger = {
  debug: (...args: unknown[]) => write('debug', args),
  info: (...args: unknown[]) => write('info', args),
  warn: (...args: unknown[]) => write('warn', args),
  error: (...args: unknown[]) => write('error', args),
};