import { ModuleRegistry, SandboxGlobals, VirtualFileSystem, DEFAULT_ENTRY } from '../core/types';
import { SecurityError } from '../core/errors';
import { resolveVfsPath } from '../compiler/analyzer';
import { getShadowedGlobals } from './scope';

export interface EvaluatorContext {
  registry: ModuleRegistry;
  globals: SandboxGlobals;
  vfs?: VirtualFileSystem;
  compiledVfs?: Record<string, string>;
  entryPath?: string;
}

function isContext(value: unknown): value is EvaluatorContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'registry' in value &&
    typeof (value as EvaluatorContext).registry === 'object'
  );
}

function pickExport(moduleExports: Record<string, any>): any {
  if (moduleExports.default) return moduleExports.default;

  const named = Object.keys(moduleExports).filter((key) => key !== 'default' && key !== '__esModule');
  return named.length > 0 ? moduleExports[named[0]] : null;
}

/**
 * Выполняет скомпилированный CommonJS-код в изолированной области.
 *
 * Поддерживает как старую сигнатуру `(code, registry, globals)`, так и
 * расширенную `(code, context)` с Virtual File System.
 */
export function executeComponent(
  compiledEntryCode: string,
  contextOrRegistry: ModuleRegistry | EvaluatorContext,
  optionalGlobals?: SandboxGlobals,
): any {
  const context: EvaluatorContext = isContext(contextOrRegistry)
    ? contextOrRegistry
    : {
        registry: contextOrRegistry,
        globals: optionalGlobals ?? { staticFile: (filename: string) => filename },
      };

  const { registry, globals } = context;
  const compiledVfs = context.compiledVfs ?? { [context.entryPath ?? DEFAULT_ENTRY]: compiledEntryCode };
  const entryPath = context.entryPath ?? DEFAULT_ENTRY;

  const React = registry['react'];
  if (!React) throw new Error("Модуль 'react' обязателен для компиляции TSX.");

  const { forbiddenKeys, shadowValues } = getShadowedGlobals();
  const globalKeys = Object.keys(globals);
  const globalValues = Object.values(globals);
  const moduleCache: Record<string, Record<string, any>> = {};

  function evaluateFile(filePath: string, code: string): Record<string, any> {
    const cached = moduleCache[filePath];
    if (cached) return cached;

    // Кэшируем до исполнения — защита от циклических зависимостей.
    const moduleExports: Record<string, any> = {};
    moduleCache[filePath] = moduleExports;

    const scopedRequire = (moduleName: string) => {
      if (registry[moduleName] !== undefined) return registry[moduleName];

      if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
        const resolved = resolveVfsPath(filePath, moduleName, compiledVfs);
        if (resolved && compiledVfs[resolved] !== undefined) {
          return evaluateFile(resolved, compiledVfs[resolved]);
        }
        throw new SecurityError(`Локальный файл "${moduleName}" не найден в Virtual File System.`);
      }

      throw new SecurityError(`Попытка импорта неразрешенного модуля: "${moduleName}"`);
    };

    try {
      const fn = new Function(
        'require',
        'exports',
        'React',
        ...globalKeys,
        ...forbiddenKeys,
        code,
      );

      fn(scopedRequire, moduleExports, React, ...globalValues, ...shadowValues);
    } catch (error) {
      if (
        error instanceof SecurityError ||
        (error as Error)?.name === 'ExecutionTimeoutError' ||
        (error as Error)?.name === 'NetworkModuleError'
      ) {
        throw error;
      }
      throw new Error(`[Runtime Error]: ${(error as Error).message}`);
    }

    return moduleExports;
  }

  const rootCode = compiledVfs[entryPath];
  if (rootCode === undefined) {
    throw new Error(`Точка входа "${entryPath}" не найдена в виртуальной файловой системе.`);
  }

  const rootExports = evaluateFile(entryPath, rootCode);
  const component = pickExport(rootExports);

  // Сохраняем вычисленные экспорты для последующего извлечения метаданных
  if (component && (typeof component === 'function' || typeof component === 'object')) {
    try {
      (component as any).__moduleExports = rootExports;
    } catch {}
  }

  return component;
}
