import { DEFAULT_MAX_ITERATIONS } from '../core/types';

const PROTECTION_MARKER = '[Infinite Loop Protection]';

function isWordChar(code: string, index: number): boolean {
  if (index < 0 || index >= code.length) return false;
  return /[A-Za-z0-9_$]/.test(code[index]);
}

function skipLiteral(code: string, start: number): number {
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

function skipLineComment(code: string, start: number): number {
  let i = start;
  while (i < code.length && code[i] !== '\n') i++;
  return i;
}

function skipBlockComment(code: string, start: number): number {
  let i = start + 2;
  while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
  return Math.min(code.length, i + 2);
}

function findMatching(code: string, openIndex: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipLiteral(code, i) - 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      i = skipLineComment(code, i) - 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      i = skipBlockComment(code, i) - 1;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function guard(counter: number, maxIterations: number): string {
  return (
    ` if (++__lp${counter} > ${maxIterations}) { ` +
    `const __loopError = new Error('${PROTECTION_MARKER}: превышен лимит ${maxIterations} итераций.'); ` +
    `__loopError.name = 'ExecutionTimeoutError'; throw __loopError; }`
  );
}

/**
 * Внедряет защиту от бесконечных циклов, оборачивая тела `for`/`while`/`do`
 * в блок со счётчиком итераций. Самодостаточно (не требует глобалов).
 */
export function injectLoopProtection(code: string, maxIterations = DEFAULT_MAX_ITERATIONS): string {
  if (code.includes(PROTECTION_MARKER)) return code;

  let out = '';
  let i = 0;
  let counter = 0;

  while (i < code.length) {
    const ch = code[i];

    if (ch === '"' || ch === "'" || ch === '`') {
      const end = skipLiteral(code, i);
      out += code.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '/' && code[i + 1] === '/') {
      const end = skipLineComment(code, i);
      out += code.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '/' && code[i + 1] === '*') {
      const end = skipBlockComment(code, i);
      out += code.slice(i, end);
      i = end;
      continue;
    }

    const atWordStart = !isWordChar(code, i - 1);

    if (atWordStart && code.startsWith('for', i) && !isWordChar(code, i + 3)) {
      const handled = tryBlockLoop(code, i, 'for', ++counter, maxIterations);
      if (handled) {
        out += handled.text;
        i = handled.end;
        continue;
      }
      counter--;
    }

    if (atWordStart && code.startsWith('while', i) && !isWordChar(code, i + 5)) {
      const handled = tryBlockLoop(code, i, 'while', ++counter, maxIterations);
      if (handled) {
        out += handled.text;
        i = handled.end;
        continue;
      }
      counter--;
    }

    if (atWordStart && code.startsWith('do', i) && !isWordChar(code, i + 2)) {
      const handled = tryDoWhile(code, i, ++counter, maxIterations);
      if (handled) {
        out += handled.text;
        i = handled.end;
        continue;
      }
      counter--;
    }

    out += ch;
    i++;
  }

  return out;
}

function tryBlockLoop(
  code: string,
  keywordIndex: number,
  keyword: 'for' | 'while',
  counter: number,
  maxIterations: number,
): { text: string; end: number } | null {
  const parenIndex = code.indexOf('(', keywordIndex + keyword.length);
  if (parenIndex === -1) return null;

  const parenClose = findMatching(code, parenIndex, '(', ')');
  if (parenClose === -1) return null;

  let braceOpen = parenClose + 1;
  while (braceOpen < code.length && /\s/.test(code[braceOpen])) braceOpen++;
  if (code[braceOpen] !== '{') return null;

  const braceClose = findMatching(code, braceOpen, '{', '}');
  if (braceClose === -1) return null;

  const text =
    `{ let __lp${counter} = 0; ` +
    code.slice(keywordIndex, braceOpen + 1) +
    guard(counter, maxIterations) +
    code.slice(braceOpen + 1, braceClose + 1) +
    ' }';

  return { text, end: braceClose + 1 };
}

function tryDoWhile(
  code: string,
  doIndex: number,
  counter: number,
  maxIterations: number,
): { text: string; end: number } | null {
  let braceOpen = doIndex + 2;
  while (braceOpen < code.length && /\s/.test(code[braceOpen])) braceOpen++;
  if (code[braceOpen] !== '{') return null;

  const braceClose = findMatching(code, braceOpen, '{', '}');
  if (braceClose === -1) return null;

  let whileIndex = braceClose + 1;
  while (whileIndex < code.length && /\s/.test(code[whileIndex])) whileIndex++;
  if (!code.startsWith('while', whileIndex)) return null;

  const parenIndex = code.indexOf('(', whileIndex);
  if (parenIndex === -1) return null;
  const parenClose = findMatching(code, parenIndex, '(', ')');
  if (parenClose === -1) return null;

  let end = parenClose + 1;
  while (end < code.length && /\s/.test(code[end])) end++;
  if (code[end] === ';') end++;

  const text =
    `{ let __lp${counter} = 0; ` +
    code.slice(doIndex, braceOpen + 1) +
    guard(counter, maxIterations) +
    code.slice(braceOpen + 1, end) +
    ' }';

  return { text, end };
}
