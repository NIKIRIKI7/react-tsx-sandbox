import { compile } from 'tailwindcss';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Загрузчик CSS-файлов для Tailwind v4 (`@import "tailwindcss/..."`).
 * Всё разрешается локально через require.resolve — скрипты рендера
 * выполняются в Node.js, сеть не нужна.
 */
async function loadStylesheet(id, base) {
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
  return { base: path.dirname(resolved), content: await readFile(resolved, 'utf8') };
}

/**
 * Извлекает потенциальные Tailwind-кандидаты из TSX-исходника:
 * строковые литералы + className/class атрибуты. Невалидные токены
 * v4-компилятор просто игнорирует.
 */
export function extractTailwindCandidates(source) {
  const candidates = new Set();

  const stringLiteralRe = /(["'`])((?:\\.|[^\\])*?)\1/g;
  let match;
  while ((match = stringLiteralRe.exec(source)) !== null) {
    extractTokens(match[2], candidates);
  }

  const plainRe = /\bclass(?:Name)?\s*=\s*(?:\{)?\s*(["'`])([\s\S]*?)\1/g;
  while ((match = plainRe.exec(source)) !== null) {
    extractTokens(match[2], candidates);
  }

  return Array.from(candidates).sort();
}

function extractTokens(str, target) {
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

/**
 * Компилирует Tailwind CSS v4 для заданного исходника.
 *
 * Аналог старого `postcss([tailwindcss({ content: [{ raw: source }] })])`
 * для Tailwind v3: тот же охват (theme + preflight + utilities),
 * но через официальный программный API `compile()`/`build(candidates)`.
 */
export async function compileTailwindCss(source, options = {}) {
  const inputCss = options.css ?? '@import "tailwindcss";';
  const compiler = await compile(inputCss, {
    base: options.base ?? path.resolve(here, '..'),
    loadStylesheet,
  });
  const candidates = options.candidates ?? extractTailwindCandidates(source);
  return compiler.build(candidates);
}