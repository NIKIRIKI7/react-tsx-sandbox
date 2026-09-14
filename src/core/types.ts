export type ModuleRegistry = Record<string, any>;

/** Виртуальная файловая система: путь -> исходный код. */
export type VirtualFileSystem = Record<string, string>;

export interface SandboxGlobals {
  staticFile: (filename: string) => string;
  [key: string]: any;
}

export interface EvaluationResult<T = any> {
  component: T | null;
  error: Error | null;
  executionTimeMs: number;
  errorPhase?: import('./errors').ErrorPhase;
}

/** Сводка HMR-обновления: какие файлы изменились, а какие переиспользованы. */
export interface HmrEvent {
  changed: string[];
  added: string[];
  removed: string[];
  recompiled: string[];
  kept: string[];
}

export type HmrUpdateResult<T = any> = EvaluationResult<T> & { hmr: HmrEvent };

/** Фабрика URL для загрузки пакета (esm.sh, jsdelivr, приватный CDN и т.п.). */
export type CdnResolver = (pkg: string) => string;

/** Абстракция компилятора: Sucrase по умолчанию, при желании — SWC/Babel. */
export interface CompilerAdapter {
  name: string;
  transform(code: string, filepath: string): Promise<string> | string;
}

export interface LoopProtectOptions {
  enabled?: boolean;
  maxIterations?: number;
}

export interface CompileOptions {
  signal?: AbortSignal;
  entry?: string;
  files?: VirtualFileSystem;
}

/** Middleware конвейера: вызывается до/после компиляции каждого файла. */
export interface PipelinePlugin {
  name: string;
  beforeCompile?: (code: string, filepath: string) => string | Promise<string>;
  afterCompile?: (compiledJs: string, filepath: string) => string | Promise<string>;
}

export const DEFAULT_ENTRY = '/App.tsx';
export const DEFAULT_MAX_ITERATIONS = 500_000;
