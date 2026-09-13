import { ModuleCache } from './cache';
import { NetworkModuleError } from '../core/errors';

export type ModuleImporter = (url: string) => Promise<any>;

const defaultImporter: ModuleImporter = (url) => import(/* @vite-ignore */ url);

/**
 * Асинхронно подгружает отсутствующие пакеты через CDN.
 *
 * `importer` — точка внедрения (dependency injection) для тестов и
 * замены CDN-провайдера без изменения логики кэша.
 */
export async function loadMissingModules(
  packages: string[],
  cache: ModuleCache,
  importer: ModuleImporter = defaultImporter,
): Promise<void> {
  const loadPromises = packages.map(async (pkg) => {
    if (cache.has(pkg)) return; // Уже в кэше (или это встроенная либа)

    try {
      const module = await importer(`https://esm.sh/${pkg}`);
      // Адаптируем ESM в формат, понятный CommonJS-require.
      // `__esModule` нужен, чтобы Sucrase-интероп `_interopRequireDefault`
      // не заворачивал модуль повторно и `default` резолвился напрямую.
      cache.register(pkg, { ...module, default: module.default || module, __esModule: true });
    } catch (error) {
      throw new NetworkModuleError(pkg, (error as Error).message);
    }
  });

  await Promise.all(loadPromises);
}
