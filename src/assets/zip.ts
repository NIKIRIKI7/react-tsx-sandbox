import { unzipSync } from 'fflate';

/**
 * Распакованный архив ресурсов: путь внутри архива -> сырые байты.
 */
export type AssetArchive = Record<string, Uint8Array>;

const IGNORED_PREFIXES = ['__MACOSX/'];

function normalizePath(path: string): string {
  return path.replace(/^\.?\//, '');
}

/**
 * Распаковывает ZIP с ассетами (медиа, шрифты, JSON) в плоскую карту байтов.
 * Служебные записи каталогов и системные папки macOS отбрасываются.
 */
export function extractAssetZip(zip: Uint8Array): AssetArchive {
  const archive: AssetArchive = {};

  for (const [rawPath, bytes] of Object.entries(unzipSync(zip))) {
    const path = normalizePath(rawPath);
    if (path === '' || path.endsWith('/')) continue;
    if (IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix))) continue;
    archive[path] = bytes;
  }

  return archive;
}

/**
 * Превращает архив в карту `filename -> url`, понятную `SandboxFacade.setAssets`
 * и глобальной функции `staticFile(filename)`.
 *
 * Фабрика URL внедряется, чтобы функцию можно было тестировать без DOM:
 * в браузере передаётся `URL.createObjectURL`.
 */
export function createAssetUrlMap(
  archive: AssetArchive,
  createUrl: (bytes: Uint8Array, filename: string) => string,
): Record<string, string> {
  const urls: Record<string, string> = {};

  for (const [path, bytes] of Object.entries(archive)) {
    const filename = path.split('/').pop()!;
    urls[filename] = createUrl(bytes, filename);
  }

  return urls;
}

/**
 * Освобождает ранее созданные `blob:`-ссылки, чтобы не текла память.
 */
export function releaseAssetUrls(
  urls: Record<string, string>,
  revoke: (url: string) => void,
): void {
  for (const url of Object.values(urls)) revoke(url);
}
