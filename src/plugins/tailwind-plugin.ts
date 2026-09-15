import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { JsScanner, TokenType } from '../compiler/scanner';
import { SandboxPlugin, PluginBuild, OnLoadArgs, TAILWIND_VIRTUAL_MODULE } from '../core/plugin';
import type { VirtualFileSystem } from '../core/types';
import { logger } from '../core/logger';

/**
 * Scoped Tailwind JIT на официальном программном API Tailwind CSS v4,
 * спроектированный по модели плагинов esbuild `onResolve` / `onLoad`.
 *
 * Компонент может объявлять `import "virtual:tailwind.css"` (или фасад подключит
 * его автоматически). Плагин перехватывает этот импорт через `onResolve`
 * (namespace `tailwind-virtual`), а в `onLoad` собирает Tailwind-кандидатов из
 * строковых токенов всех файлов VFS и отдаёт готовый JS-модуль, инжектирующий
 * `<style>` с scoped CSS. Никаких текстовых wrapper-ов вокруг скомпилированного
 * React-кода больше нет.
 */

export const TAILWIND_SCOPE = '__tsx_tw';
export { TAILWIND_VIRTUAL_MODULE } from '../core/plugin';
const TAILWIND_NAMESPACE = 'tailwind-virtual';

export interface TailwindJitPluginOptions {
  /** Имя плагина. По умолчанию `tailwind-jit`. */
  name?: string;
  /** Класс-область для scoping. По умолчанию `__tsx_tw`. */
  scope?: string;
  /** Дополнительный CSS для входного файла компилятора (кастомные `@theme` и пр.). */
  css?: string;
  /** Базовый путь для разрешения `@import` в `loadStylesheet`. По умолчанию `process.cwd()`. */
  base?: string;
  /** Кастомный генератор CSS: (classes, scopeClass) => css. По умолчанию официальный compile()/build(). */
  builder?: (classes: string[], scopeClass: string) => string | Promise<string>;
}

// ---- Кэши ----------------------------------------------------------------
// `compilerCache` хранит скомпилированные дизайн-системы (экземпляры компилятора),
// `cssCache` — готовый scoped CSS. Кэши ограничены (LRU поверх Map).

const COMPILER_CACHE_LIMIT = 20;
const compilerCache = new Map<string, Promise<{ build(candidates: string[]): string }>>();

const CSS_CACHE_LIMIT = 500;
const cssCache = new Map<string, string>();

function cacheCss(key: string, css: string): string {
  cssCache.set(key, css);
  if (cssCache.size > CSS_CACHE_LIMIT) {
    cssCache.delete(cssCache.keys().next().value as string);
  }
  return css;
}

// ---- Загрузка стилей -----------------------------------------------------

/**
 * Загрузчик CSS-файлов для Tailwind v4 (`@import "tailwindcss/..."`).
 *
 * В среде Node.js импорты разрешаются через `createRequire`, в браузере —
 * fallback на CDN (jsDelivr). Ветка Node активируется только при наличии
 * `process.versions.node`, поэтому модуль безопасно импортировать в браузере.
 */
async function defaultLoadStylesheet(
  id: string,
  base: string,
): Promise<{ path: string; base: string; content: string }> {
  // 1. Среда Node.js (тесты, Remotion SSR, CLI-рендеры).
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const [{ createRequire }, { readFile }, path] = await Promise.all([
        import('node:module'),
        import('node:fs/promises'),
        import('node:path'),
      ]);
      const require = createRequire(import.meta.url);

      let resolved = id;
      if (id === 'tailwindcss' || id === 'tailwindcss/index.css') {
        resolved = require.resolve('tailwindcss/index.css');
      } else if (id.startsWith('tailwindcss/')) {
        const sub = id.slice('tailwindcss/'.length);
        const withCss = sub.endsWith('.css') ? sub : `${sub}.css`;
        resolved = require.resolve(`tailwindcss/${withCss}`);
      } else if (id.startsWith('.')) {
        resolved = path.resolve(base, id);
      } else {
        try {
          resolved = require.resolve(id);
        } catch {
          resolved = path.resolve(base, id);
        }
      }

      const content = await readFile(resolved, 'utf-8');
      return { path: resolved, base: path.dirname(resolved), content };
    } catch (err) {
      throw new Error(
        `[Tailwind v4 JIT] Не удалось загрузить стили "${id}": ${(err as Error).message}`,
      );
    }
  }

  // 2. Среда браузера (fallback на CDN для `@import`).
  const cdnUrl = id.startsWith('tailwindcss')
    ? `https://cdn.jsdelivr.net/npm/${id.endsWith('.css') ? id : `${id}.css`}`
    : id;
  const res = await fetch(cdnUrl);
  if (!res.ok) throw new Error(`Failed to fetch stylesheet ${id} from ${cdnUrl}`);
  const content = await res.text();
  return { path: cdnUrl, base: '', content };
}

// ---- Scoping -------------------------------------------------------------

/**
 * Изолирует сгенерированный Tailwind v4 CSS внутри селектора scopeClass.
 *
 * Переменные темы объявляются в v4 на `:root, :host` — они переносятся на
 * `.${scopeClass}`, чтобы стили песочницы не утекали наружу. Правила утилит
 * префиксуются `.${scopeClass} .utility`. `@keyframes` остаются глобальными.
 */
export function scopeCss(rawCss: string, scopeClass: string): string {
  const root = postcss.parse(rawCss);
  const cleanScope = scopeClass.replace(/^\./, '');
  // Базовый класс скоупа: '__tsx_tw' (без хэш-суффикса) — плеер всегда вешает его на canvas.
  const baseScope = cleanScope.split('-')[0];
  const selectorScope = `.${cleanScope}`;
  const canvasSelector = `[data-remotion-canvas="true"]`;

  root.walkRules((rule) => {
    if (
      rule.parent &&
      rule.parent.type === 'atrule' &&
      (rule.parent as postcss.AtRule).name === 'keyframes'
    ) {
      return;
    }

    rule.selectors = rule.selectors.map((sel) => {
      const trimmed = sel.trim();
      if (trimmed === ':root' || trimmed === ':host' || trimmed === 'html' || trimmed === 'body') {
        return `${selectorScope}, .${baseScope}, ${canvasSelector}`;
      }
      return `${selectorScope} ${trimmed}, .${baseScope} ${trimmed}, ${canvasSelector} ${trimmed}`;
    });
  });

  return root.toString();
}

// ---- Сбор кандидатов -----------------------------------------------------

/**
 * Извлекает классы из `className`/`class` атрибутов (для обратной совместимости,
 * кастомных builder-функций и юнит-тестов).
 */
export function collectTailwindClasses(code: string): string[] {
  const classes = new Set<string>();

  const attrRe = /className\s*=\s*(?:\{)?\s*(["'`])([\s\S]*?)\1/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(code)) !== null) {
    const raw = match[2];
    if (raw.includes('${')) {
      const parts = raw.split(/\$\{[^}]*\}/);
      for (const part of parts) extractTokens(part, classes);
      continue;
    }
    extractTokens(raw, classes);
  }

  const plainRe = /\bclass\s*=\s*"([^"]+)"/g;
  while ((match = plainRe.exec(code)) !== null) {
    extractTokens(match[1], classes);
  }

  return Array.from(classes).sort();
}

/**
 * Сканирует все потенциальные Tailwind-кандидаты из исходного кода файла
 * (строковые литералы + className/class). Некорректные токены v4-компилятор
 * просто игнорирует, поэтому избыточность сканера безопасна.
 */
export function extractAllCandidates(source: string): string[] {
  const candidates = new Set<string>();

  const stringLiteralRe = /(["'`])((?:\\.|[^\\])*?)\1/g;
  let match: RegExpExecArray | null;
  while ((match = stringLiteralRe.exec(source)) !== null) {
    extractTokens(match[2], candidates);
  }

  for (const cls of collectTailwindClasses(source)) {
    candidates.add(cls);
  }

  return Array.from(candidates).sort();
}

/**
 * Токенный экстрактор Tailwind-кандидатов: обходит исходник через `JsScanner`,
 * собирая классы только из строковых литералов и NoSubstitutionTemplate.
 * В отличие от регулярного подхода, строки внутри комментариев, ключевые
 * слова и JSX-разметка не дают ложных срабатываний.
 */
export function extractClassNamesFromSource(source: string): string[] {
  const scanner = new JsScanner(source);
  const candidates = new Set<string>();

  let token = scanner.nextToken(true);
  while (token.type !== TokenType.EOF) {
    if (token.type === TokenType.StringLiteral || token.type === TokenType.NoSubstitutionTemplate) {
      const raw = token.value.slice(1, -1);
      for (const part of raw.split(/\s+/)) {
        const trimmed = part.trim();
        if (trimmed.length > 1 && !trimmed.includes('\n')) {
          candidates.add(trimmed);
        }
      }
    }
    token = scanner.nextToken(token.type === TokenType.Punctuator);
  }

  return Array.from(candidates).sort();
}

/**
 * Собирает кандидатов из всех файлов VFS через токенный сканер.
 */
function collectCandidatesFromVfs(vfs: VirtualFileSystem): string[] {
  const candidates = new Set<string>();
  for (const code of Object.values(vfs)) {
    for (const cls of extractClassNamesFromSource(code)) {
      candidates.add(cls);
    }
  }
  return Array.from(candidates).sort();
}

function extractTokens(str: string, target: Set<string>): void {
  for (const token of str.split(/\s+/)) {
    const trimmed = token.trim();
    if (!trimmed || trimmed.length < 2) continue;
    if (trimmed.includes('${')) continue;
    if (trimmed.endsWith('-')) continue;
    if (trimmed.includes('/') && !trimmed.match(/^[\w-]+(?:\/[\w.%-]+)+$/)) continue;
    if (!/^[\w/:.%.\-\[\]#!]+$/.test(trimmed)) continue;
    target.add(trimmed);
  }
}

// ---- Компилятор v4 -------------------------------------------------------

/**
 * Получает или инициализирует компилятор Tailwind v4 (дизайн-систему).
 * Скомпилированный экземпляр кэшируется: `build(candidates)` затем работает
 * практически мгновенно (sub-millisecond).
 */
async function getCompiler(
  inputCss: string,
  base?: string,
): Promise<{ build(candidates: string[]): string }> {
  const cacheKey = `${base || ''}:${inputCss}`;
  let pending = compilerCache.get(cacheKey);
  if (!pending) {
    pending = compile(inputCss, {
      base: base ?? (typeof process !== 'undefined' ? process.cwd() : '/'),
      loadStylesheet: defaultLoadStylesheet,
    });
    compilerCache.set(cacheKey, pending);
    if (compilerCache.size > COMPILER_CACHE_LIMIT) {
      compilerCache.delete(compilerCache.keys().next().value as string);
    }
  }
  return pending;
}

const V4_BASE_CSS = `
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
`;

/**
 * Компилирует изолированный CSS через официальный JIT-движок Tailwind CSS v4.
 *
 * Принимает либо сырой исходник (строка), либо явный список кандидатов (массив).
 * Возвращает CSS, где правила утилит и переменные темы скоуплены классом области.
 */
export async function scopedTailwindCss(
  scopeClass: string,
  contentOrClasses: string | string[],
  options: { css?: string; base?: string } = {},
): Promise<string> {
  const cleanScope = scopeClass.replace(/^\./, '');
  const candidates = Array.isArray(contentOrClasses)
    ? contentOrClasses
    : extractAllCandidates(contentOrClasses);

  const inputCss = options.css ? `${V4_BASE_CSS}\n${options.css}` : V4_BASE_CSS;

  const cacheKey = `${cleanScope}:${candidates.join(',')}:${inputCss}`;
  const cached = cssCache.get(cacheKey);
  if (cached !== undefined) {
    cssCache.delete(cacheKey);
    cssCache.set(cacheKey, cached);
    return cached;
  }

  const compiler = await getCompiler(inputCss, options.base);
  const rawCss = compiler.build(candidates);
  const scopedResult = scopeCss(rawCss, cleanScope);

  return cacheCss(cacheKey, scopedResult);
}

// ---- Плагин --------------------------------------------------------------

function hashCode(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Создаёт плагин Tailwind V4 JIT в модели `onResolve` / `onLoad` (esbuild).
 *
 * Компонент объявляет `import "virtual:tailwind.css"`. `onResolve` маршрутизирует
 * импорт в namespace `tailwind-virtual`, `onLoad` генерирует JS-модуль, который
 * инжектирует `<style data-tailwind-jit>` с scoped CSS и экспортирует CSS-строку.
 *
 * Каждый файл песочницы остаётся нетронутым — никаких wrapper-компонентов вокруг
 * экспортов, никаких текстовых манипуляций со скомпилированным кодом.
 */
export function createTailwindPlugin(options: TailwindJitPluginOptions = {}): SandboxPlugin {
  const scope = options.scope ?? TAILWIND_SCOPE;

  return {
    name: options.name ?? 'tailwind-jit',

    setup(build: PluginBuild): void {
      build.onResolve(
        { filter: /^virtual:tailwind\.css$/, namespace: 'file' },
        (args) => ({
          path: args.path,
          namespace: TAILWIND_NAMESPACE,
        }),
      );

      build.onLoad({ filter: /.*/, namespace: TAILWIND_NAMESPACE }, async (args: OnLoadArgs) => {
        const scopeClass = `${scope}-${Math.abs(hashCode(TAILWIND_VIRTUAL_MODULE)).toString(36)}`;
        const candidates = args.vfs ? collectCandidatesFromVfs(args.vfs) : [];

        logger.debug('Tailwind JIT: onLoad', {
          path: args.path,
          namespace: args.namespace,
          files: args.vfs ? Object.keys(args.vfs) : [],
          candidates,
          candidateCount: candidates.length,
          scopeClass,
        });

        let css: string;
        try {
          css = options.builder
            ? await options.builder(candidates, scopeClass)
            : await scopedTailwindCss(scopeClass, candidates, {
                css: options.css,
                base: options.base,
              });
        } catch (error) {
          logger.error('Tailwind JIT: ошибка компиляции CSS', {
            message: error instanceof Error ? error.message : String(error),
            candidates,
            scopeClass,
          });
          throw error;
        }

        logger.debug('Tailwind JIT: CSS сгенерирован', {
          scopeClass,
          cssBytes: css.length,
          cssHead: css.slice(0, 200),
        });

        // ПРЯМАЯ ИНЪЕКЦИЯ В <head> НА СТОРОНЕ ПЛАГИНА (ВНЕ МЕМБРАНЫ ПЕСОЧНИЦЫ).
        // Внутри песочницы `document` входит в FORBIDDEN_GLOBALS и равен undefined,
        // поэтому инъекция из виртуального модуля никогда не сработала бы.
        if (typeof globalThis !== 'undefined' && globalThis.document?.head) {
          const hostDoc = globalThis.document;
          let hostStyle = hostDoc.head.querySelector<HTMLStyleElement>('[data-tailwind-jit]');
          if (!hostStyle) {
            hostStyle = hostDoc.createElement('style');
            hostStyle.setAttribute('data-tailwind-jit', 'true');
            hostDoc.head.appendChild(hostStyle);
          }
          hostStyle.textContent = css;
          logger.debug('Tailwind JIT: CSS внедрён в <head>', {
            scopeClass,
            bytes: css.length,
          });
        } else {
          logger.warn('Tailwind JIT: document недоступен на стороне плагина, инъекция пропущена', {
            hasGlobalThis: typeof globalThis !== 'undefined',
            hasDocument: typeof globalThis !== 'undefined' && Boolean(globalThis.document),
          });
        }

        const jsonCss = JSON.stringify(css);
        const scopeCls = JSON.stringify(scopeClass);

        return {
          loader: 'js',
          contents: `
const scopeCls = ${scopeCls};
const injectedCss = ${jsonCss};
// Безопасная инъекция через globalThis (на случай отдельного контекста исполнения).
try {
  const doc = typeof globalThis !== 'undefined' ? globalThis.document : null;
  if (doc && doc.head) {
    let style = doc.head.querySelector('[data-tailwind-jit]');
    if (!style) {
      style = doc.createElement('style');
      style.setAttribute('data-tailwind-jit', 'true');
      doc.head.appendChild(style);
    }
    style.textContent = injectedCss;
  }
} catch (_) {}
module.exports = injectedCss;
exports.default = injectedCss;
`,
        };
      });
    },
  };
}