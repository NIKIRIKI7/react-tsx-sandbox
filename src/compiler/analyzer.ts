/**
 * Извлекает имена NPM-пакетов (bare imports) из сырого TSX кода.
 * Локальные (`./`, `../`) и абсолютные (`/`) импорты игнорируются.
 */
export function extractBareImports(code: string): string[] {
  const importRegex =
    /import\s+(?:(?:\*\s+as\s+\w+|[\w\s{},]+)\s+from\s+)?['"]([^'"]+)['"]/g;
  const matches = [...code.matchAll(importRegex)];

  const bareImports = matches
    .map((m) => m[1])
    .filter((specifier) => !specifier.startsWith('.') && !specifier.startsWith('/'));

  return [...new Set(bareImports)];
}
