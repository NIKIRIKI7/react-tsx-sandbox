import { useState, useEffect, useRef } from 'react';
import { SandboxFacade } from '../facade';
import { ModuleRegistry } from '../core/types';
import { ModuleImporter } from '../library-manager/loader';
import * as React from 'react';

export interface CompiledComponentInfo {
  component: React.ComponentType<any>;
  executionTimeMs: number;
}

export interface UseLiveSandboxOptions {
  /** Кастомный загрузчик npm-пакетов (по умолчанию — esm.sh). */
  importer?: ModuleImporter;
  /** Вызывается при ошибке компиляции/загрузки. */
  onError?: (error: Error) => void;
  /** Вызывается после успешной компиляции. */
  onCompiled?: (info: CompiledComponentInfo) => void;
}

export interface UseLiveSandboxResult {
  Component: React.ComponentType<any> | null;
  error: Error | null;
  isCompiling: boolean;
}

/**
 * Готовый React-хук для бесшовной интеграции песочницы.
 *
 * Внимание: `localAssets` не должен попадать в зависимости эффекта по ссылке —
 * иначе новый объект на каждый рендер запускает бесконечный цикл рекомпиляции.
 * Поэтому мы сравниваем сериализованный ключ ассетов. Колбэки и импортёр
 * читаются через ref, чтобы не пересоздавать эффект.
 */
export function useLiveSandbox(
  code: string,
  initialModules: ModuleRegistry,
  localAssets: Record<string, string> = {},
  options: UseLiveSandboxOptions = {},
): UseLiveSandboxResult {
  const facadeRef = useRef<SandboxFacade | null>(null);
  const assetsRef = useRef(localAssets);
  assetsRef.current = localAssets;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  // Инициализация фасада (единожды)
  if (!facadeRef.current) {
    // Автоматически добавляем React, если его забыли
    const modules = { react: React, ...initialModules };
    facadeRef.current = new SandboxFacade(modules, options.importer);
  }

  const assetsKey = JSON.stringify(localAssets);

  useEffect(() => {
    if (!code) return;

    let isMounted = true;
    setIsCompiling(true);

    facadeRef.current!.setAssets(assetsRef.current);

    facadeRef.current!
      .compile(code)
      .then((result) => {
        if (!isMounted) return;

        if (result.error) {
          setError(result.error);
          setComponent(null);
          optionsRef.current.onError?.(result.error);
        } else {
          setError(null);
          setComponent(() => result.component);
          optionsRef.current.onCompiled?.({
            component: result.component,
            executionTimeMs: result.executionTimeMs,
          });
        }
        setIsCompiling(false);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setError(err);
        setComponent(null);
        optionsRef.current.onError?.(err);
        setIsCompiling(false);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, assetsKey]);

  return { Component, error, isCompiling };
}
