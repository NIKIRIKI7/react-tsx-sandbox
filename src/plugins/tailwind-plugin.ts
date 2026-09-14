import { compile } from 'tailwindcss';
import postcss from 'postcss';
import type { PipelinePlugin } from '../core/types';

/**
 * Scoped Tailwind JIT на официальном программном API Tailwind CSS v4.
 *
 * В v4 движок больше не использует PostCSS-плагин и параметр `content`. Пакет
 * `tailwindcss` напрямую экспортирует асинхронный компилятор `compile(inputCss,
 * { loadStylesheet })`, который возвращает экземпляр с методом
 * `build(candidates)`, генерирующим точный срез CSS только для переданных
 * токенов (классов, включая arbitrary-значения, современные цветовые
 * пространства OKLCH и градиенты).
 *
 * Плагин сканирует исходник файла на Tailwind-кандидаты, прогоняет их через
 * `compiler.build(candidates)` и оборачивает компонент в `<div className={scope}>`
 * с собственным `<style>`. Через `scopeCss` переменные темы (`:root, :host`)
 * привязываются к классу области, а правила утилит префиксуются
 * `.${scopeClass} .utility` — стили песочницы не «протекают» наружу.
 * `@keyframes` при этом остаются глобальными.
 */

export const TAILWIND_SCOPE = '__tsx_tw';

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
// `cssCache` — готовый scoped CSS. Кэши ограничены (LRU поверх Map), чтобы при
// HMR/ре-рендерах повторно компилировать только реально изменившиеся связки.

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
 * `process.versions.node`, поэтому модуль безопасно импортировать в браузере:
 * зависимости `node:*` запрашиваются лениво, внутри загрузчика.
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
 * `.${scopeClass}`, чтобы стили песочницы не утекали наружу и не ломали
 * плеер/хост. Правила утилит префиксуются `.${scopeClass} .utility`.
 * `@keyframes` остаются глобальными.
 */
export function scopeCss(rawCss: string, scopeClass: string): string {
  const root = postcss.parse(rawCss);
  const selectorScope = `.${scopeClass}`;

  root.walkRules((rule) => {
    // Не трогаем ключевые кадры внутри @keyframes (0%, 100%, from, to).
    if (
      rule.parent &&
      rule.parent.type === 'atrule' &&
      (rule.parent as postcss.AtRule).name === 'keyframes'
    ) {
      return;
    }

    rule.selectors = rule.selectors.map((sel) => {
      const trimmed = sel.trim();
      // Переменные темы и базовые свойства переносим на контейнер компонента.
      if (trimmed === ':root' || trimmed === ':host' || trimmed === 'html' || trimmed === 'body') {
        return selectorScope;
      }
      return `${selectorScope} ${trimmed}`;
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
function extractAllCandidates(source: string): string[] {
  const candidates = new Set<string>();

  // Сканируем строковые литералы (в объектах, массивах, пропсах).
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

function extractTokens(str: string, target: Set<string>): void {
  for (const token of str.split(/\s+/)) {
    const trimmed = token.trim();
    if (!trimmed || trimmed.length < 2) continue;
    if (trimmed.includes('${')) continue;
    // Незавершённые токены (например, `p-` из интерполированного `p-${size}`).
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

/**
 * Создаёт плагин конвейера для scoped Tailwind JIT (v4).
 *
 * Каждый файл оборачивается в `<div className={scope}>` со своим `<style>`,
 * поэтому классы песочницы не влияют на UI хоста. Кэш дизайн-системы
 * переиспользуется между компиляциями: только `build(candidates)` выполняется
 * заново на каждом кадре/изменении кода.
 */
export function createTailwindJitPlugin(options: TailwindJitPluginOptions = {}): PipelinePlugin {
  const scope = options.scope ?? TAILWIND_SCOPE;
  const rawSources = new Map<string, string>();
  const collected = new Map<string, string[]>();

  return {
    name: options.name ?? 'tailwind-jit',

    beforeCompile(code: string, filepath: string): string {
      rawSources.set(filepath, code);
      collected.set(filepath, collectTailwindClasses(code));
      return code;
    },

    async afterCompile(compiledJs: string, filepath: string): Promise<string> {
      const rawCode = rawSources.get(filepath) ?? compiledJs;
      const classes = collected.get(filepath) ?? collectTailwindClasses(rawCode);
      const scopeClass = `${scope}-${Math.abs(hashCode(filepath)).toString(36)}`;

      const css = options.builder
        ? await options.builder(classes, scopeClass)
        : await scopedTailwindCss(scopeClass, rawCode, {
            css: options.css,
            base: options.base,
          });

      const jsonCss = JSON.stringify(css);
      const wrapper = `
;(function () {
  var Original = exports.default;
  if (!Original && typeof exports !== 'undefined') {
    for (var k in exports) {
      if (k !== 'default' && k !== '__esModule' && typeof exports[k] === 'function') {
        Original = exports[k];
        break;
      }
    }
  }
  if (!Original || typeof Original !== 'function') return;
  var scopeCls = ${JSON.stringify(scopeClass)};
  var injectedCss = ${jsonCss};
  function TailwindJitWrapper(props) {
    return React.createElement('div', { className: scopeCls },
      React.createElement('style', { dangerouslySetInnerHTML: { __html: injectedCss } }),
      React.createElement(Original, props)
    );
  }
  for (var prop in Original) {
    if (Object.prototype.hasOwnProperty.call(Original, prop)) {
      TailwindJitWrapper[prop] = Original[prop];
    }
  }
  TailwindJitWrapper.displayName = 'TailwindJit(${filepath.replace(/[^\w]/g, '_')})';
  exports.default = TailwindJitWrapper;
})();
`;
      return compiledJs + wrapper;
    },
  };
}

function hashCode(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}