import { CdnResolver } from '../core/types';
import { NetworkModuleError } from '../core/errors';
import { ModuleCache } from './cache';

export type ModuleImporter = (url: string, signal?: AbortSignal) => Promise<any>;

export interface LoadModulesOptions {
  importer?: ModuleImporter;
  cdnResolver?: CdnResolver;
  signal?: AbortSignal;
}

export const defaultCdnResolver: CdnResolver = (pkg: string) => `https://esm.sh/${pkg}`;

export const defaultImporter: ModuleImporter = (url) =>
  (new Function('u', 'return import(u)') as (u: string) => Promise<any>)(url);

/**
 * Асинхронно подгружает отсутствующие пакеты через CDN.
 *
 * Третий аргумент — либо `ModuleImporter` (обратная совместимость),
 * либо объект `LoadModulesOptions` с `cdnResolver`/`signal`.
 */
export async function loadMissingModules(
  packages: string[],
  cache: ModuleCache,
  importerOrOptions: ModuleImporter | LoadModulesOptions = {},
): Promise<void> {
  const options: LoadModulesOptions =
    typeof importerOrOptions === 'function' ? { importer: importerOrOptions } : importerOrOptions;

  const importer = options.importer ?? defaultImporter;
  const cdnResolver = options.cdnResolver ?? defaultCdnResolver;
  const signal = options.signal;

  const missing = packages.filter((pkg) => !cache.has(pkg));
  if (missing.length === 0) return;

  await Promise.all(
    missing.map(async (pkg) => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      try {
        const resolvedUrl = cdnResolver(pkg);
        const loaded = signal ? await importer(resolvedUrl, signal) : await importer(resolvedUrl);
        // `__esModule` нужен, чтобы Sucrase-интероп `_interopRequireDefault`
        // не заворачивал модуль повторно и `default` резолвился напрямую.
        cache.register(pkg, { ...loaded, default: loaded.default || loaded, __esModule: true });
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new NetworkModuleError(pkg, (error as Error).message);
      }
    }),
  );
}
