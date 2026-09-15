import { DEFAULT_MAX_ITERATIONS } from '../core/types';
import { JsScanner, Token, TokenType } from './scanner';

const PROTECTION_MARKER = '[Infinite Loop Protection]';

interface Span {
  start: number;
  end: number;
  text: string;
}

function guard(counter: number, maxIterations: number): string {
  return (
    `if (++__lp${counter} > ${maxIterations}) { ` +
    `const __lpErr = new Error('${PROTECTION_MARKER}: превышен лимит ${maxIterations} итераций.'); ` +
    `__lpErr.name = 'ExecutionTimeoutError'; throw __lpErr; }`
  );
}

/**
 * Внедряет защиту от бесконечных циклов, оборачивая тела `for`, `while`
 * и `do...while` в блок со счётчиком итераций. Анализ ведётся через
 * токенизатор (`JsScanner`), поэтому ключевые слова внутри строк,
 * комментариев, регулярных выражений и шаблонных литералов не трогаются,
 * а фигурные скобки `{}` в этих конструкциях не рассинхронизируют парсер.
 *
 * Обрабатываются и циклы без фигурных скобок (`while (c) foo();`).
 * Самодостаточно — не требует глобалов, идемпотентно.
 */
export function injectLoopProtection(code: string, maxIterations = DEFAULT_MAX_ITERATIONS): string {
  if (code.includes(PROTECTION_MARKER)) return code;

  const scanner = new JsScanner(code);
  const patches: Span[] = [];
  let loopCounter = 0;
  let prevToken: Token | null = null;
  let token = scanner.nextToken(true);

  while (token.type !== TokenType.EOF) {
    // `foo.for` / `foo.while` — доступ к свойству, а не управляющая конструкция.
    const isPropAccess = prevToken?.type === TokenType.Punctuator && prevToken.value === '.';

    if (token.type === TokenType.Keyword && !isPropAccess) {
      if (token.value === 'for' || token.value === 'while') {
        const handled = handleForWhile(scanner, token, maxIterations, ++loopCounter, patches);
        if (handled) {
          prevToken = token;
          token = scanner.nextToken(true);
          continue;
        }
        loopCounter--;
      } else if (token.value === 'do') {
        const handled = handleDoWhile(scanner, token, maxIterations, ++loopCounter, patches);
        if (handled) {
          prevToken = token;
          token = scanner.nextToken(true);
          continue;
        }
        loopCounter--;
      }
    }

    prevToken = token;
    const canBeRegex = token.type === TokenType.Punctuator || token.type === TokenType.Keyword;
    token = scanner.nextToken(canBeRegex);
  }

  if (patches.length === 0) return code;

  // Применяем патчи от конца к началу, чтобы не сбивать смещения.
  patches.sort((a, b) => b.start - a.start);
  let result = code;
  for (const patch of patches) {
    result = result.slice(0, patch.start) + patch.text + result.slice(patch.end);
  }
  return result;
}

/** Сканирует заголовок цикла `for (...)`/`while (...)` и возвращает тело. */
function readLoopHead(scanner: JsScanner, keyword: Token): Token | null {
  // `for await (const x of y)` — пропускаем `await`.
  let paren = scanner.nextToken(false);
  if (
    keyword.value === 'for' &&
    paren.type === TokenType.Keyword &&
    paren.value === 'await'
  ) {
    paren = scanner.nextToken(false);
  }
  if (paren.type !== TokenType.Punctuator || paren.value !== '(') {
    return null;
  }

  let parenDepth = 1;
  let head = scanner.nextToken(true);
  while (head.type !== TokenType.EOF && !(head.type === TokenType.Punctuator && head.value === ')' && --parenDepth === 0)) {
    if (head.type === TokenType.Punctuator && head.value === '(') parenDepth++;
    head = scanner.nextToken(true);
  }
  if (head.type === TokenType.EOF) return null;

  return scanner.nextToken(true);
}

function handleForWhile(
  scanner: JsScanner,
  keyword: Token,
  maxIterations: number,
  loopId: number,
  patches: Span[],
): boolean {
  const bodyToken = readLoopHead(scanner, keyword);
  if (!bodyToken || bodyToken.type === TokenType.EOF) return false;

  const counterDecl = `{let __lp${loopId}=0;`;
  const guardStmt = ` ${guard(loopId, maxIterations)} `;

  // Тело — блочное: `for (...) { ... }`
  if (bodyToken.type === TokenType.Punctuator && bodyToken.value === '{') {
    let braceDepth = 1;
    let inner = scanner.nextToken(true);
    let closeBrace: Token | null = null;
    while (inner.type !== TokenType.EOF && !(inner.type === TokenType.Punctuator && inner.value === '}' && --braceDepth === 0)) {
      if (inner.type === TokenType.Punctuator && inner.value === '{') braceDepth++;
      inner = scanner.nextToken(true);
    }
    if (inner.type === TokenType.EOF) return false;

    closeBrace = inner;
    patches.push({ start: keyword.start, end: keyword.start, text: counterDecl });
    patches.push({ start: bodyToken.end, end: bodyToken.end, text: guardStmt });
    patches.push({ start: closeBrace.end, end: closeBrace.end, text: '}' });
    return true;
  }

  // Однострочное тело без фигурных скобок: `while (c) foo();`
  const stmtEnd = findStatementEnd(scanner, bodyToken);
  patches.push({ start: keyword.start, end: keyword.start, text: counterDecl });
  patches.push({ start: bodyToken.start, end: bodyToken.start, text: `{ ${guardStmt} ` });
  patches.push({ start: stmtEnd, end: stmtEnd, text: '}}' });
  return true;
}

function handleDoWhile(
  scanner: JsScanner,
  doToken: Token,
  maxIterations: number,
  loopId: number,
  patches: Span[],
): boolean {
  const bodyToken = scanner.nextToken(true);
  if (!bodyToken || bodyToken.type === TokenType.EOF) return false;

  const counterDecl = `{let __lp${loopId}=0;`;
  const guardStmt = ` ${guard(loopId, maxIterations)} `;

  let bodyEnd: number;

  // Блочное тело: `do { ... } while (...);`
  if (bodyToken.type === TokenType.Punctuator && bodyToken.value === '{') {
    let braceDepth = 1;
    let inner = scanner.nextToken(true);
    while (inner.type !== TokenType.EOF && !(inner.type === TokenType.Punctuator && inner.value === '}' && --braceDepth === 0)) {
      if (inner.type === TokenType.Punctuator && inner.value === '{') braceDepth++;
      inner = scanner.nextToken(true);
    }
    if (inner.type === TokenType.EOF) return false;
    bodyEnd = inner.end; // конец тела; далее ожидаем `while`
    patches.push({ start: bodyToken.end, end: bodyToken.end, text: guardStmt });
  } else {
    // Однострочное тело: `do foo(); while (x);` — ищем первый `while` на глубине 0.
    let t = bodyToken;
    let parenDepth = 0;
    let braceDepth = 0;
    let whileToken: Token | null = null;
    while (t.type !== TokenType.EOF && !whileToken) {
      if (t.type === TokenType.Punctuator) {
        if (t.value === '(') parenDepth++;
        else if (t.value === ')') parenDepth--;
        else if (t.value === '{') braceDepth++;
        else if (t.value === '}') braceDepth--;
      } else if (t.type === TokenType.Keyword && t.value === 'while' && parenDepth === 0 && braceDepth === 0) {
        whileToken = t;
        break;
      }
      t = scanner.nextToken(true);
    }
    if (!whileToken) return false;
    bodyEnd = whileToken.start;
    patches.push({ start: bodyToken.start, end: bodyToken.start, text: `{ ${guardStmt} ` });
  }

  // Поглощаем хвостовой `while (...)` и точку с запятой, чтобы не обработать их повторно.
  let tail = scanner.nextToken(false);
  if (tail.type !== TokenType.Keyword || tail.value !== 'while') return false;

  let paren = scanner.nextToken(false);
  if (paren.type !== TokenType.Punctuator || paren.value !== '(') return false;

  let parenDepth = 1;
  let head = scanner.nextToken(true);
  while (head.type !== TokenType.EOF && !(head.type === TokenType.Punctuator && head.value === ')' && --parenDepth === 0)) {
    if (head.type === TokenType.Punctuator && head.value === '(') parenDepth++;
    head = scanner.nextToken(true);
  }
  if (head.type === TokenType.EOF) return false;

  let semi = scanner.nextToken(false);
  const closingPos = semi.type === TokenType.Punctuator && semi.value === ';' ? semi.end : head.end;

  patches.push({ start: doToken.start, end: doToken.start, text: counterDecl });
  if (bodyToken.type === TokenType.Punctuator && bodyToken.value === '{') {
    // Блочное тело закрывается само; counter-блок закрываем после `;`.
  } else {
    // Однострочное тело: закрываем обёртку guard'а перед `while`.
    patches.push({ start: bodyEnd, end: bodyEnd, text: '}' });
  }
  patches.push({ start: closingPos, end: closingPos, text: '}' });
  return true;
}

/** Находит конец простого оператора (однострочного тела цикла). */
function findStatementEnd(scanner: JsScanner, first: Token): number {
  let t = first;
  let parenDepth = 0;
  let braceDepth = 0;

  while (t.type !== TokenType.EOF) {
    if (t.type === TokenType.Punctuator) {
      if (t.value === '(') parenDepth++;
      else if (t.value === ')') parenDepth--;
      else if (t.value === '{') braceDepth++;
      else if (t.value === '}') {
        if (braceDepth === 0) return t.start; // встретили закрывающую скобку объёма
        braceDepth--;
      } else if (t.value === ';' && parenDepth === 0 && braceDepth === 0) {
        return t.end;
      }
    }
    t = scanner.nextToken(true);
  }
  return scanner.position;
}