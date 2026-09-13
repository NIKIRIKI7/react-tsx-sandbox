import { VirtualFileSystem } from '../core/types';

export interface ScanResult {
  bareImports: string[];
  localImports: string[];
  dynamicImports: string[];
}

function skipLineComment(code: string, start: number): number {
  let i = start + 2;
  while (i < code.length && code[i] !== '\n') i++;
  return i;
}

function skipBlockComment(code: string, start: number): number {
  let i = start + 2;
  while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
  return Math.min(code.length, i + 2);
}

function skipString(code: string, start: number): number {
  const quote = code[start];
  let i = start + 1;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    i++;
  }
  return code.length;
}

/**
 * Удаляет комментарии, сохраняя строковые литералы. Заменяет комментарии
 * пробелом, чтобы не склеивать токены.
 */
export function stripComments(code: string): string {
  let out = '';
  let i = 0;

  while (i < code.length) {
    const ch = code[i];
    if (ch === '/' && code[i + 1] === '/') {
      i = skipLineComment(code, i);
      out += ' ';
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      i = skipBlockComment(code, i);
      out += ' ';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = skipString(code, i);
      out += code.slice(i, end);
      i = end;
      continue;
    }
    out += ch;
    i++;
  }

  return out;
}

const STATIC_IMPORT_RE = /(?:import|export)\s+(?:(?:[\w*\s{},$]+)\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function classify(specifier: string, bare: Set<string>, local: Set<string>): void {
  const value = specifier.trim();
  if (!value) return;
  if (value.startsWith('.') || value.startsWith('/')) local.add(value);
  else bare.add(value);
}

/**
 * Извлекает зависимости: внешние (bare) пакеты, локальные пути VFS
 * и статические динамические импорты. Устойчиво к комментариям.
 */
export function scanImports(code: string): ScanResult {
  const clean = stripComments(code);
  const bare = new Set<string>();
  const local = new Set<string>();
  const dynamic = new Set<string>();

  let match: RegExpExecArray | null;

  STATIC_IMPORT_RE.lastIndex = 0;
  while ((match = STATIC_IMPORT_RE.exec(clean)) !== null) {
    classify(match[1], bare, local);
  }

  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((match = DYNAMIC_IMPORT_RE.exec(clean)) !== null) {
    const value = match[1].trim();
    classify(value, bare, local);
    if (value.startsWith('.') || value.startsWith('/')) dynamic.add(value);
    else dynamic.add(value);
  }

  return {
    bareImports: [...bare],
    localImports: [...local],
    dynamicImports: [...dynamic],
  };
}

/** Обратно совместимый хелпер: только внешние пакеты. */
export function extractBareImports(code: string): string[] {
  return scanImports(code).bareImports;
}

function normalizePath(path: string): string {
  const parts = path.split('/').filter((part) => part.length > 0 && part !== '.');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return '/' + stack.join('/');
}

/**
 * Резолвит относительный/абсолютный путь внутри Virtual File System,
 * подбирая расширения (.tsx/.ts/.jsx/.js/.json).
 */
export function resolveVfsPath(
  currentFile: string,
  relativePath: string,
  vfs: VirtualFileSystem,
): string | null {
  const slash = currentFile.lastIndexOf('/');
  const currentDir = slash > 0 ? currentFile.slice(0, slash) : '';
  const basePath = relativePath.startsWith('/') ? relativePath : `${currentDir}/${relativePath}`;
  const normalized = normalizePath(basePath);

  const candidates = [
    normalized,
    normalized + '.tsx',
    normalized + '.ts',
    normalized + '.jsx',
    normalized + '.js',
    normalized + '.json',
    normalized + '/index.tsx',
    normalized + '/index.ts',
    normalized + '/index.jsx',
    normalized + '/index.js',
  ];

  for (const candidate of candidates) {
    if (vfs[candidate] !== undefined) return candidate;
    const withoutSlash = candidate.replace(/^\//, '');
    if (vfs[withoutSlash] !== undefined) return withoutSlash;
  }

  return null;
}
