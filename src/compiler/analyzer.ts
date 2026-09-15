import { VirtualFileSystem } from '../core/types';
import { JsScanner, TokenType } from './scanner';
import { resolveVirtualPath } from './path';

export interface ScanResult {
  bareImports: string[];
  localImports: string[];
  dynamicImports: string[];
}

/** Удаляет комментарии, сохраняя строковые литералы. Заменяет их пробелом. */
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

function classify(specifier: string, bare: Set<string>, local: Set<string>): void {
  const value = specifier.trim();
  if (!value) return;
  if (value.startsWith('.') || value.startsWith('/')) local.add(value);
  else bare.add(value);
}

function unquote(raw: string): string {
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

/**
 * Анализирует зависимости JS/TSX-файла с помощью токенизатора.
 *
 * Точно различает статические импорты, реэкспорты `export ... from`,
 * динамические `import(...)`, `require(...)` и игнорирует ложные вхождения
 * слов import/from внутри строк, комментариев, шаблонных литералов и JSX.
 */
export function scanImports(code: string): ScanResult {
  const scanner = new JsScanner(code);
  const bare = new Set<string>();
  const local = new Set<string>();
  const dynamic = new Set<string>();

  let prevTokenVal = '';
  let token = scanner.nextToken(true);

  while (token.type !== TokenType.EOF) {
    if (token.type === TokenType.Keyword || token.type === TokenType.Identifier) {
      // 1. Статический `import` (выражение, спецификатор или `import('pkg')`).
      if (token.value === 'import') {
        const next = scanner.nextToken(false);

        // Динамический импорт: import('pkg')
        if (next.type === TokenType.Punctuator && next.value === '(') {
          const arg = scanner.nextToken(true);
          if (arg.type === TokenType.StringLiteral) {
            const specifier = unquote(arg.value).trim();
            if (specifier) {
              classify(specifier, bare, local);
              dynamic.add(specifier);
            }
          }
        }
        // Сайд-эффект импорт: import 'specifier'
        else if (next.type === TokenType.StringLiteral) {
          const specifier = unquote(next.value).trim();
          if (specifier) classify(specifier, bare, local);
        }
        // Обычный импорт / import type: ищем `from 'specifier'`
        else {
          scanUntilFrom(scanner, bare, local);
        }
      }

      // 2. Экспорт из модуля: export ... from 'specifier'
      else if (token.type === TokenType.Keyword && token.value === 'export') {
        scanUntilFrom(scanner, bare, local);
      }

      // 3. Вызов require('specifier') (не свойство объекта).
      else if (token.value === 'require' && prevTokenVal !== '.') {
        const next = scanner.nextToken(false);
        if (next.type === TokenType.Punctuator && next.value === '(') {
          const arg = scanner.nextToken(true);
          if (arg.type === TokenType.StringLiteral) {
            const specifier = unquote(arg.value).trim();
            if (specifier) classify(specifier, bare, local);
          }
        }
      }
    }

    prevTokenVal = token.value;
    const canBeRegex = token.type === TokenType.Punctuator || token.type === TokenType.Keyword;
    token = scanner.nextToken(canBeRegex);
  }

  return {
    bareImports: Array.from(bare).sort(),
    localImports: Array.from(local).sort(),
    dynamicImports: Array.from(dynamic).sort(),
  };
}

function scanUntilFrom(
  scanner: JsScanner,
  bare: Set<string>,
  local: Set<string>,
): void {
  let t = scanner.nextToken(true);
  while (t.type !== TokenType.EOF && t.value !== ';') {
    if (t.type === TokenType.Keyword && t.value === 'from') {
      const specToken = scanner.nextToken(false);
      if (specToken.type === TokenType.StringLiteral) {
        const specifier = unquote(specToken.value).trim();
        if (specifier) classify(specifier, bare, local);
      }
      break;
    }
    t = scanner.nextToken(true);
  }
}

/** Обратно совместимый хелпер: только внешние пакеты. */
export function extractBareImports(code: string): string[] {
  return scanImports(code).bareImports;
}

/**
 * Резолвит относительный/абсолютный путь внутри Virtual File System,
 * подбирая расширения (.tsx/.ts/.jsx/.js/.json) и индексные файлы.
 * Легковесная обёртка над каноническим резолвером `compiler/path`.
 */
export function resolveVfsPath(
  currentFile: string,
  relativePath: string,
  vfs: VirtualFileSystem,
): string | null {
  return resolveVirtualPath(currentFile, relativePath, vfs);
}