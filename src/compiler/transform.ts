import { transform } from 'sucrase';
import { CompilerError } from '../core/errors';
import { CompilerAdapter } from '../core/types';

/**
 * Убирает markdown-ограждения ```tsx ... ``` вокруг кода.
 */
export function cleanMarkdownFences(code: string): string {
  let cleaned = code.trim();

  if (cleaned.startsWith('```')) {
    const newline = cleaned.indexOf('\n');
    cleaned = newline !== -1 ? cleaned.slice(newline + 1) : '';
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, cleaned.lastIndexOf('```')).trim();
  }

  return cleaned;
}

function getSnippet(source: string, line: number, column?: number): string {
  const lines = source.split('\n');
  const start = Math.max(0, line - 2);
  const end = Math.min(lines.length, line + 1);

  const body = lines
    .slice(start, end)
    .map((text, index) => {
      const lineNumber = start + index + 1;
      const marker = lineNumber === line ? '>' : ' ';
      return `${marker} ${lineNumber} | ${text}`;
    })
    .join('\n');

  const caret =
    column !== undefined
      ? `\n  | ${' '.repeat(Math.max(0, column))}^`
      : '';

  return body + caret;
}

function parseLocation(message: string): { line?: number; column?: number } {
  const match = message.match(/\((\d+):(\d+)\)/);
  if (!match) return {};
  return { line: Number(match[1]), column: Number(match[2]) };
}

/**
 * Транспилирует TSX в CommonJS (React.createElement).
 */
export function compileTsx(code: string, filename = 'component.tsx'): string {
  const cleanCode = cleanMarkdownFences(code);

  try {
    const compiled = transform(cleanCode, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'classic',
      filePath: filename,
    });

    return compiled.code;
  } catch (error) {
    const original = error as Error & { loc?: { line: number; column: number } };
    const fromLoc = original.loc ? { line: original.loc.line, column: original.loc.column } : {};
    const { line, column } = { ...parseLocation(original.message ?? ''), ...fromLoc };
    const snippet = line !== undefined ? getSnippet(cleanCode, line, column) : undefined;

    throw new CompilerError(original.message ?? 'Ошибка компиляции TSX', line, column, snippet);
  }
}

/** Адаптер компилятора по умолчанию (Sucrase). */
export class SucraseCompilerAdapter implements CompilerAdapter {
  readonly name = 'sucrase';

  transform(code: string, filepath = 'component.tsx'): string {
    return compileTsx(code, filepath);
  }
}
