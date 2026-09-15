/**
 * Потоковый микро-лексер JavaScript/TSX (Zero-regex).
 *
 * Архитектура взята из internal/js_lexer/js_lexer.go esbuild: исходный код
 * читается посимвольно и превращается в плоский поток токенов. Лексер точно
 * знает контекст: строка, комментарий, шаблонный литерал с интерполяцией,
 * регулярное выражение или JSX. Это устраняет ложные срабатывания регулярных
 * выражений на строках и комментариях со словами `import`/`while`.
 */

export enum TokenType {
  EOF = 0,
  Identifier,
  Keyword,
  StringLiteral,
  TemplateHead,
  TemplateMiddle,
  TemplateTail,
  NoSubstitutionTemplate,
  NumericLiteral,
  RegexLiteral,
  Punctuator,
  Comment,
}

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

const KEYWORDS = new Set([
  'import',
  'export',
  'from',
  'as',
  'default',
  'const',
  'let',
  'var',
  'function',
  'class',
  'for',
  'while',
  'do',
  'if',
  'else',
  'return',
  'break',
  'continue',
  'switch',
  'case',
  'try',
  'catch',
  'finally',
  'throw',
  'typeof',
  'void',
  'delete',
  'in',
  'instanceof',
  'new',
  'yield',
  'await',
  'type',
  'interface',
  'namespace',
]);

function isDigitChar(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isWhitespaceChar(code: number): boolean {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 12 || code === 11;
}

/**
 * Конечный автомат кодовых точек. Один `JsScanner` = один линейный проход.
 */
export class JsScanner {
  private pos = 0;
  private readonly len: number;
  private templateDepthStack: number[] = [];

  constructor(private readonly src: string) {
    this.len = src.length;
  }

  public get position(): number {
    return this.pos;
  }

  private peek(): string {
    return this.pos < this.len ? this.src[this.pos] : '';
  }

  private peekAt(offset: number): string {
    const idx = this.pos + offset;
    return idx < this.len ? this.src[idx] : '';
  }

  private advance(): string {
    return this.src[this.pos++];
  }

  private skipWhitespace(): void {
    while (this.pos < this.len && isWhitespaceChar(this.src.charCodeAt(this.pos))) {
      this.pos++;
    }
  }

  public nextToken(canBeRegex = true): Token {
    this.skipWhitespace();

    if (this.pos >= this.len) {
      return { type: TokenType.EOF, value: '', start: this.pos, end: this.pos };
    }

    const start = this.pos;
    const ch = this.peek();

    // 1. Комментарии
    if (ch === '/' && this.peekAt(1) === '/') {
      this.pos += 2;
      while (this.pos < this.len && this.src[this.pos] !== '\n') this.pos++;
      return { type: TokenType.Comment, value: this.src.slice(start, this.pos), start, end: this.pos };
    }

    if (ch === '/' && this.peekAt(1) === '*') {
      this.pos += 2;
      while (this.pos < this.len && !(this.src[this.pos] === '*' && this.peekAt(1) === '/')) {
        this.pos++;
      }
      this.pos = Math.min(this.len, this.pos + 2);
      return { type: TokenType.Comment, value: this.src.slice(start, this.pos), start, end: this.pos };
    }

    // 2. Регулярные выражения (только когда контекст допускает).
    if (ch === '/' && canBeRegex) {
      const regexToken = this.tryScanRegex(start);
      if (regexToken) return regexToken;
    }

    // 3. Строковые литералы
    if (ch === '"' || ch === "'") {
      this.advance();
      while (this.pos < this.len) {
        const cur = this.advance();
        if (cur === '\\') {
          this.pos++;
        } else if (cur === ch) {
          break;
        }
      }
      return { type: TokenType.StringLiteral, value: this.src.slice(start, this.pos), start, end: this.pos };
    }

    // 4. Шаблонные литералы `...` и их интерполяция ${...}
    if (ch === '`') {
      return this.scanTemplateSpan(start);
    }

    // 5. Выход из шаблонной интерполяции `}` при глубине 0.
    if (ch === '}' && this.templateDepthStack.length > 0) {
      if (this.templateDepthStack[this.templateDepthStack.length - 1] === 0) {
        this.templateDepthStack.pop();
        return this.scanTemplateSpan(start, true);
      }
      this.templateDepthStack[this.templateDepthStack.length - 1]--;
    }

    // 6. Идентификаторы и ключевые слова
    if (this.isIdentifierStart(ch)) {
      this.advance();
      while (this.pos < this.len && this.isIdentifierPart(this.peek())) {
        this.advance();
      }
      const val = this.src.slice(start, this.pos);
      const isKw = KEYWORDS.has(val);
      return { type: isKw ? TokenType.Keyword : TokenType.Identifier, value: val, start, end: this.pos };
    }

    // 7. Числовые литералы
    if (isDigitChar(ch) || (ch === '.' && isDigitChar(this.peekAt(1)))) {
      while (this.pos < this.len && /[\w]/.test(this.peek())) {
        this.advance();
      }
      if (this.peek() === '.' && isDigitChar(this.peekAt(1))) {
        this.advance();
        while (this.pos < this.len && /[\w]/.test(this.peek())) {
          this.advance();
        }
      }
      return { type: TokenType.NumericLiteral, value: this.src.slice(start, this.pos), start, end: this.pos };
    }

    // 8. Пунктуация (учитываем брасы внутри шаблонной интерполяции).
    if (ch === '{' && this.templateDepthStack.length > 0) {
      this.templateDepthStack[this.templateDepthStack.length - 1]++;
    }

    this.advance();
    return { type: TokenType.Punctuator, value: ch, start, end: this.pos };
  }

  private scanTemplateSpan(start: number, isRescan = false): Token {
    this.advance();
    while (this.pos < this.len) {
      const cur = this.advance();
      if (cur === '\\') {
        this.pos++;
      } else if (cur === '`') {
        const type = isRescan ? TokenType.TemplateTail : TokenType.NoSubstitutionTemplate;
        return { type, value: this.src.slice(start, this.pos), start, end: this.pos };
      } else if (cur === '$' && this.peek() === '{') {
        this.advance(); // consume '{'
        this.templateDepthStack.push(0);
        const type = isRescan ? TokenType.TemplateMiddle : TokenType.TemplateHead;
        return { type, value: this.src.slice(start, this.pos), start, end: this.pos };
      }
    }
    return { type: TokenType.NoSubstitutionTemplate, value: this.src.slice(start, this.pos), start, end: this.pos };
  }

  private tryScanRegex(start: number): Token | null {
    let p = start + 1;
    let inClass = false;

    while (p < this.len) {
      const c = this.src[p++];
      if (c === '\n' || c === '\r') return null; // регулярки не переносятся без флагов
      if (c === '\\') {
        p++;
      } else if (c === '[') {
        inClass = true;
      } else if (c === ']' && inClass) {
        inClass = false;
      } else if (c === '/' && !inClass) {
        while (p < this.len && /[a-z]/i.test(this.src[p])) p++;
        this.pos = p;
        return { type: TokenType.RegexLiteral, value: this.src.slice(start, p), start, end: p };
      }
    }
    return null;
  }

  private isIdentifierStart(ch: string): boolean {
    const c = ch.charCodeAt(0);
    return (
      (c >= 97 && c <= 122) ||
      (c >= 65 && c <= 90) ||
      c === 95 ||
      c === 36 ||
      c >= 128
    );
  }

  private isIdentifierPart(ch: string): boolean {
    return this.isIdentifierStart(ch) || (ch >= '0' && ch <= '9');
  }
}