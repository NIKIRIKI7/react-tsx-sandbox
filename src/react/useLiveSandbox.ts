import { useEffect, useRef, useState } from 'react';
import { SandboxFacade, SandboxFacadeOptions } from '../facade';
import { HmrEvent, ModuleRegistry, VirtualFileSystem } from '../core/types';
import { RuntimeRenderError } from '../core/errors';
import * as React from 'react';

export interface CompiledComponentInfo {
  component: React.ComponentType<any>;
  executionTimeMs: number;
}

export interface UseLiveSandboxOptions extends SandboxFacadeOptions {
  /** Задержка перед компиляцией (для Monaco/CodeMirror). По умолчанию 0. */
  debounceMs?: number;
  /** Точка входа VFS. По умолчанию `/App.tsx`. */
  entry?: string;
  /** Инкрементальная перекомпиляция VFS (только для object-VFS). По умолчанию false. */
  hmr?: boolean;
  /** Колбэк ошибки компиляции/загрузки. */
  onError?: (error: Error) => void;
  /** Колбэк успешной компиляции. */
  onCompiled?: (info: CompiledComponentInfo) => void;
}

export interface UseLiveSandboxResult {
  Component: React.ComponentType<any> | null;
  error: Error | null;
  isCompiling: boolean;
  runtimeError: RuntimeRenderError | Error | null;
  setRuntimeError: (error: RuntimeRenderError | Error | null) => void;
  /** Сводка последнего HMR-обновления (когда включён `hmr`). */
  lastHmr?: HmrEvent | null;
}

/**
 * React-хук песочницы: компилирует код (или VFS) с дебаунсом и отменой
 * устаревших компиляций через AbortController.
 */
export function useLiveSandbox(
  codeOrFiles: string | VirtualFileSystem,
  initialModules: ModuleRegistry = {},
  localAssets: Record<string, string> = {},
  options: UseLiveSandboxOptions = {},
): UseLiveSandboxResult {
  const facadeRef = useRef<SandboxFacade | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  if (!facadeRef.current) {
    facadeRef.current = new SandboxFacade(
      { react: React, ...initialModules },
      {
        compiler: options.compiler,
        cdnResolver: options.cdnResolver,
        importer: options.importer,
        loopProtect: options.loopProtect,
        maxIterations: options.maxIterations,
        plugins: options.plugins,
      },
    );
  }

  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [runtimeError, setRuntimeError] = useState<RuntimeRenderError | Error | null>(null);
  const [isCompiling, setIsCompiling] = useState(true);
  const [lastHmr, setLastHmr] = useState<HmrEvent | null>(null);

  const inputKey = typeof codeOrFiles === 'string' ? codeOrFiles : JSON.stringify(codeOrFiles);
  const assetsKey = JSON.stringify(localAssets ?? {});
  const debounceMs = options.debounceMs ?? 0;

  useEffect(() => {
    const facade = facadeRef.current!;
    facade.setAssets(localAssets ?? {});

    let isMounted = true;
    const controller = new AbortController();
    setIsCompiling(true);
    setRuntimeError(null);

    const derive = (result: { component: any; error: Error | null; executionTimeMs: number }) => {
      if (result.error) {
        setError(result.error);
        setComponent(null);
        optionsRef.current.onError?.(result.error);
      } else if (result.component) {
        setError(null);
        setComponent(() => result.component);
        optionsRef.current.onCompiled?.({
          component: result.component,
          executionTimeMs: result.executionTimeMs,
        });
      }
    };

    const timer = setTimeout(() => {
      const useHmr = optionsRef.current.hmr === true && typeof codeOrFiles !== 'string';

      const evaluation = useHmr
        ? facade.hmrUpdate(codeOrFiles as VirtualFileSystem, {
            signal: controller.signal,
            entry: optionsRef.current.entry,
          })
        : facade.compile(codeOrFiles, { signal: controller.signal, entry: optionsRef.current.entry });

      evaluation
        .then((result) => {
          if (!isMounted || controller.signal.aborted) return;
          derive(result);
          if (useHmr && 'hmr' in result) setLastHmr((result as { hmr: HmrEvent }).hmr);
        })
        .catch((err: unknown) => {
          if (!isMounted || controller.signal.aborted) return;
          const normalized = err instanceof Error ? err : new Error(String(err));
          setError(normalized);
          setComponent(null);
          optionsRef.current.onError?.(normalized);
        })
        .finally(() => {
          if (isMounted) setIsCompiling(false);
        });
    }, debounceMs);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, assetsKey, debounceMs]);

  return { Component, error, isCompiling, runtimeError, setRuntimeError, lastHmr };
}
