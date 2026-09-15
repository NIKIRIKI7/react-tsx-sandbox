/**
 * Диагностика, LineColumnTracker и SourceMap-ремаппинг.
 * Аналог: `esbuild/internal/logger/logger.go` и `internal/sourcemap/sourcemap.go`.
 *
 * Декодирует VLQ-карты без внешних npm-пакетов, сопоставляет рантайм-стектрейсы
 * с оригинальным `.tsx` кодом и формирует наглядный сниппет с маркером `^`.
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_TABLE = new Int8Array(128).fill(-1);
for (let i = 0; i < BASE64_CHARS.length; i++) {
  BASE64_TABLE[BASE64_CHARS.charCodeAt(i)] = i;
}

function decodeVlq(str: string, index: number): [value: number, nextIndex: number] {
  let result = 0;
  let shift = 0;
  let continuation = true;

  while (continuation) {
    if (index >= str.length) throw new Error('Непредвиденный конец VLQ-строки');
    const b64 = BASE64_TABLE[str.charCodeAt(index++)];
    if (b64 === -1) throw new Error('Недопустимый символ в VLQ-последовательности');
    continuation = (b64 & 32) !== 0;
    result += (b64 & 31) << shift;
    shift += 5;
  }

  const isNegative = (result & 1) === 1;
  const value = result >> 1;
  return [isNegative ? -value : value, index];
}

export interface SourceMapping {
  generatedLine: number;
  generatedColumn: number;
  originalSource?: string;
  originalLine: number;
  originalColumn: number;
}

export interface SourceMapInput {
  sources?: string[];
  mappings?: string;
}

/**
 * Быстрый легковесный парсер Source Map V3 (только mappings/sources).
 */
export class RawSourceMapConsumer {
  private mappings: SourceMapping[] = [];

  constructor(private readonly rawMap: SourceMapInput) {
    this.parse();
  }

  private parse(): void {
    const raw = this.rawMap.mappings;
    if (!raw) return;

    let generatedLine = 1;
    let previousGeneratedColumn = 0;
    let previousSourceIndex = 0;
    let previousOriginalLine = 0;
    let previousOriginalColumn = 0;
    let index = 0;

    while (index < raw.length) {
      const ch = raw[index];
      if (ch === ';') {
        generatedLine++;
        previousGeneratedColumn = 0;
        index++;
        continue;
      }
      if (ch === ',') {
        index++;
        continue;
      }

      let genColDelta: number;
      [genColDelta, index] = decodeVlq(raw, index);
      previousGeneratedColumn += genColDelta;

      if (index < raw.length && raw[index] !== ',' && raw[index] !== ';') {
        let srcIdxDelta: number;
        let origLineDelta: number;
        let origColDelta: number;
        [srcIdxDelta, index] = decodeVlq(raw, index);
        [origLineDelta, index] = decodeVlq(raw, index);
        [origColDelta, index] = decodeVlq(raw, index);

        previousSourceIndex += srcIdxDelta;
        previousOriginalLine += origLineDelta;
        previousOriginalColumn += origColDelta;

        this.mappings.push({
          generatedLine,
          generatedColumn: previousGeneratedColumn,
          originalSource: this.rawMap.sources?.[previousSourceIndex],
          originalLine: previousOriginalLine + 1,
          originalColumn: previousOriginalColumn,
        });

        // Пропускаем name-field при наличии
        if (index < raw.length && raw[index] !== ',' && raw[index] !== ';') {
          const [, nextIdx] = decodeVlq(raw, index);
          index = nextIdx;
        }
      }
    }
  }

  public originalPositionFor(genLine: number, genCol: number): {
    source: string | null;
    line: number | null;
    column: number | null;
  } {
    let match: SourceMapping | null = null;
    for (const m of this.mappings) {
      if (m.generatedLine === genLine) {
        if (m.generatedColumn <= genCol) {
          match = m;
        } else {
          break;
        }
      } else if (m.generatedLine > genLine) {
        break;
      }
    }

    if (match && match.originalLine !== undefined) {
      return {
        source: match.originalSource ?? null,
        line: match.originalLine,
        column: match.originalColumn,
      };
    }

    return { source: null, line: null, column: null };
  }
}

/**
 * Вычисляет позиции строк и форматирует сообщение об ошибке с подсветкой места сбоя.
 */
export class LineColumnTracker {
  private lineOffsets: number[] = [0];

  constructor(private readonly content: string) {
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) {
        this.lineOffsets.push(i + 1);
      }
    }
  }

  public formatFrame(line: number, column: number, length = 1, message = ''): string {
    const lines = this.content.split('\n');
    const zeroLine = line - 1;
    if (zeroLine < 0 || zeroLine >= lines.length) return message;

    const startLineIdx = Math.max(0, zeroLine - 1);
    const endLineIdx = Math.min(lines.length, zeroLine + 2);
    const gutterWidth = String(endLineIdx).length;

    let output = message ? `\n${message}\n\n` : '\n';

    for (let i = startLineIdx; i < endLineIdx; i++) {
      const lineNum = String(i + 1).padStart(gutterWidth, ' ');
      const isTarget = i === zeroLine;
      const marker = isTarget ? '>' : ' ';
      output += `${marker} ${lineNum} │ ${lines[i]}\n`;

      if (isTarget) {
        const caretPad = ' '.repeat(gutterWidth + 3 + Math.max(0, column));
        const caret = '^' + '~'.repeat(Math.max(0, length - 1));
        output += `  ${caretPad}${caret}\n`;
      }
    }

    return output;
  }
}

/**
 * Ремаппит нативный стектрейс JavaScript на исходные файлы VFS.
 */
export function remapStackTrace(
  stack: string,
  sourceMaps: Map<string, RawSourceMapConsumer>,
  vfsSources: Record<string, string>,
): string {
  const lines = stack.split('\n');
  const remappedLines = lines.map((line) => {
    // Паттерн: at ... (eval at ..., /App.tsx:12:34)
    const match = line.match(/(.*?\((?:.*?eval at .*?, )?)(.*?):(\d+):(\d+)(\).*)/);
    if (!match) return line;

    const [, prefix, file, lineStr, colStr, suffix] = match;
    const consumer = sourceMaps.get(file);
    if (!consumer) return line;

    const orig = consumer.originalPositionFor(Number(lineStr), Number(colStr));
    if (!orig.line) return line;

    const origFile = orig.source || file;
    let snippet = '';
    const originalContent = vfsSources[origFile];
    if (originalContent) {
      const tracker = new LineColumnTracker(originalContent);
      snippet = '\n' + tracker.formatFrame(orig.line, orig.column ?? 0, 3);
    }

    return `${prefix}${origFile}:${orig.line}:${(orig.column ?? 0) + 1}${suffix}${snippet}`;
  });

  return remappedLines.join('\n');
}