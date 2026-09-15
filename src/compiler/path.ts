import type { VirtualFileSystem } from '../core/types';

/**
 * Канонический резолвер путей виртуальной файловой системы.
 *
 * Аналог internal/fs/filepath.go + internal/resolver/resolver.go из esbuild:
 * нормализация разделителей (Windows `\` -> `/`), разрешение `.`/`..`,
 * префиксы пространств имён (`asset:`, `data:`, `cdn:`) и перебор
 * расширений/индексных файлов в порядке приоритета.
 */

export const DEFAULT_EXTENSIONS: readonly string[] = [
  '',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.json',
  '/index.tsx',
  '/index.ts',
  '/index.jsx',
  '/index.js',
];

/**
 * Канонизирует путь: приводит `\` к `/`, устраняет дублирующиеся слэши,
 * разрешает `.` и `..` и предотвращает выход за пределы корня.
 */
export function normalizeCanonicalPath(rawPath: string): string {
  if (!rawPath) return '/';

  // Разделение протокола/namespace при наличии (например, asset: или data:).
  const protoIdx = rawPath.indexOf('://');
  let prefix = '';
  let path = rawPath;

  if (protoIdx !== -1) {
    prefix = rawPath.slice(0, protoIdx + 3);
    path = rawPath.slice(protoIdx + 3);
  }

  const isAbs =
    path.startsWith('/') || path.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(path);
  const clean = path.replace(/\\/g, '/');
  const segments = clean.split('/').filter((s) => s.length > 0 && s !== '.');
  const stack: string[] = [];

  for (const seg of segments) {
    if (seg === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop();
      } else if (!isAbs) {
        stack.push('..');
      }
    } else {
      stack.push(seg);
    }
  }

  const resolved = stack.join('/');
  if (prefix) return prefix + resolved;
  if (isAbs) return '/' + resolved;
  return resolved || '.';
}

/** Возвращает директорию для заданного пути файла. */
export function getDirname(filepath: string): string {
  const norm = normalizeCanonicalPath(filepath);
  const lastSlash = norm.lastIndexOf('/');
  if (lastSlash === -1) return '.';
  if (lastSlash === 0) return '/';
  return norm.slice(0, lastSlash);
}

/**
 * Разрешает импортируемый спецификатор относительно текущего файла внутри VFS.
 *
 * Алгоритм Node/ESM: точное совпадение -> перебор расширений -> индексные файлы.
 * Барe-модули (`react`, `@scope/pkg`) не разрешаются (возвращается null) —
 * они обрабатываются библиотекой-менеджером.
 */
export function resolveVirtualPath(
  currentFile: string,
  importSpecifier: string,
  vfs: VirtualFileSystem,
  extensions: readonly string[] = DEFAULT_EXTENSIONS,
): string | null {
  const spec = importSpecifier.trim();
  if (!spec) return null;

  let candidateBase: string;
  if (spec.startsWith('/')) {
    candidateBase = normalizeCanonicalPath(spec);
  } else if (spec.startsWith('.')) {
    const dir = getDirname(currentFile);
    candidateBase = normalizeCanonicalPath(dir === '/' ? `/${spec}` : `${dir}/${spec}`);
  } else {
    // Bare module (внешний пакет).
    return null;
  }

  for (const ext of extensions) {
    const candidate = normalizeCanonicalPath(candidateBase + ext);
    if (Object.prototype.hasOwnProperty.call(vfs, candidate)) {
      return candidate;
    }
    // Проверка без начального слэша для совместимости с ключами без префикса.
    const alt = candidate.replace(/^\//, '');
    if (Object.prototype.hasOwnProperty.call(vfs, alt)) {
      return alt;
    }
  }

  return null;
}