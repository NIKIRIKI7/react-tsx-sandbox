import { useState, useEffect, useRef } from 'react';
import { SandboxFacade } from '../facade';
import { ModuleRegistry } from '../core/types';
import * as React from 'react';

/**
 * Готовый React-хук для бесшовной интеграции песочницы.
 *
 * Внимание: `localAssets` не должен попадать в зависимости эффекта по ссылке —
 * иначе новый объект на каждый рендер запускает бесконечный цикл рекомпиляции.
 * Поэтому мы сравниваем сериализованный ключ ассетов.
 */
export function useLiveSandbox(
  code: string,
  initialModules: ModuleRegistry,
  localAssets: Record<string, string> = {},
) {
  const facadeRef = useRef<SandboxFacade | null>(null);
  const assetsRef = useRef(localAssets);
  assetsRef.current = localAssets;

  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  // Инициализация фасада (единожды)
  if (!facadeRef.current) {
    // Автоматически добавляем React, если его забыли
    const modules = { react: React, ...initialModules };
    facadeRef.current = new SandboxFacade(modules);
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
        } else {
          setError(null);
          setComponent(() => result.component);
        }
        setIsCompiling(false);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setError(err);
        setComponent(null);
        setIsCompiling(false);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, assetsKey]);

  return { Component, error, isCompiling };
}
