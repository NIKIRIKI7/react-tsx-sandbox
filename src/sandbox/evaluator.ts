import { ModuleRegistry, SandboxGlobals } from '../core/types';
import { getShadowedGlobals } from './scope';
import { SecurityError } from '../core/errors';

export function executeComponent(
  compiledCode: string,
  registry: ModuleRegistry,
  globals: SandboxGlobals,
): any {
  const customRequire = (moduleName: string) => {
    if (registry[moduleName]) return registry[moduleName];
    throw new SecurityError(`Попытка импорта неразрешенного модуля: "${moduleName}"`);
  };

  const exportsObj = { default: null };
  const React = registry['react'];

  if (!React) throw new Error("Модуль 'react' обязателен для компиляции TSX.");

  const { forbiddenKeys, shadowValues } = getShadowedGlobals();
  const globalKeys = Object.keys(globals);
  const globalValues = Object.values(globals);

  try {
    const fn = new Function(
      'require',
      'exports',
      'React',
      ...globalKeys,
      ...forbiddenKeys,
      compiledCode,
    );

    fn(customRequire, exportsObj, React, ...globalValues, ...shadowValues);

    // Приоритет `default`, иначе — первый именованный экспорт (например, `export const Scene`).
    if (exportsObj.default) return exportsObj.default;

    const namedExport = Object.keys(exportsObj).find((key) => key !== 'default');
    return namedExport ? (exportsObj as any)[namedExport] : null;
  } catch (error) {
    // Не заворачиваем наши собственные ошибки безопасности в generic Runtime Error.
    if (error instanceof SecurityError) throw error;
    throw new Error(`[Runtime Error]: ${(error as Error).message}`);
  }
}
