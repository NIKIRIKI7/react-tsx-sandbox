#!/usr/bin/env node
/**
 * Проверка модульной архитектуры browser-tsx-sandbox.
 *
 * Гарантирует, что установленные границы модулей не нарушаются:
 *   - src/core      не зависят от react/sandbox/compiler/timeline/export/plugins
 *   - src/compiler  не зависят от react/sandbox/timeline/export
 *   - src/timeline  не зависят от sandbox/compiler/export/plugins
 *   - src/export    не зависят от react и sandbox/evaluator.ts
 *
 * Плюс поиск циклических зависимостей по всему дереву src/.
 * Запуск: npm run arch
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, extname, dirname, join, sep } from 'node:path';

const ROOT = resolve(process.cwd());
let errors = 0;

const RULES = [
  {
    module: 'src/core',
    forbidden: ['src/react', 'src/sandbox', 'src/compiler', 'src/timeline', 'src/export', 'src/plugins'],
    reason: 'Ядро не должно зависеть от реализаций песочницы или UI.',
  },
  {
    module: 'src/compiler',
    forbidden: ['src/react', 'src/sandbox', 'src/timeline', 'src/export'],
    reason: 'Компилятор не должен зависеть от механизмов исполнения кода или UI.',
  },
  {
    module: 'src/timeline',
    forbidden: ['src/sandbox', 'src/compiler', 'src/export', 'src/plugins'],
    reason: 'Таймлайн должен оставаться чистым слоем данных.',
  },
  {
    module: 'src/export',
    forbidden: ['src/react', 'src/sandbox/evaluator.ts'],
    reason: 'Экспорт не должен зависеть от React-компонентов и должен работать без песочницы.',
  },
];

const IMPORT_REGEX =
  /(?:import|export)\s+(?:(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]|(?:[\w*\s{},$]*)\s+from\s+['"]([^'"]+)['"])|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

async function findFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await findFiles(full)));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function getImports(code) {
  const imports = [];
  let match;
  IMPORT_REGEX.lastIndex = 0;
  while ((match = IMPORT_REGEX.exec(code)) !== null) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) imports.push(specifier);
  }
  return imports;
}

function resolveImportPath(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null; // bare — внешний пакет
  const base = dirname(fromFile);
  const candidates = [resolve(base, specifier)];
  const exts = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx'];
  for (const ext of exts) {
    const p = candidates[0] + ext;
    if (p.startsWith(ROOT)) return p;
  }
  return candidates[0];
}

function inModule(file, modulePath) {
  const norm = file.replace(/\\/g, '/');
  return norm.startsWith(`${modulePath}/`);
}

async function checkBoundaries(files) {
  const processed = [];
  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const code = await readFile(file, 'utf8');
    const rule = RULES.find((r) => inModule(rel, r.module));
    if (!rule) continue;
    for (const specifier of getImports(code)) {
      const resolved = resolveImportPath(file, specifier);
      if (!resolved) continue;
      const target = relative(ROOT, resolved).replace(/\\/g, '/');
      const forbidden = rule.forbidden.find((f) => target.startsWith(`${f.replace(/\\/g, '/')}`));
      if (forbidden) {
        errors++;
        console.error(`❌ [Нарушение границы] ${rel}`);
        console.error(`   Импортирует запрещённый модуль: ${forbidden}`);
        console.error(`   Причина: ${rule.reason}`);
      }
    }
    processed.push({ rel, code });
  }
  return processed;
}

function detectCycles(files) {
  const graph = new Map();
  const all = new Map();
  for (const { rel, code } of files) {
    all.set(rel, new Set());
    for (const specifier of getImports(code)) {
      const resolved = resolveImportPath(join(ROOT, rel.replace(/\//g, sep)), specifier);
      if (!resolved) continue;
      const target = relative(ROOT, resolved).replace(/\\/g, '/');
      if (all.has(target)) all.get(rel).add(target);
    }
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();
  const stack = [];

  function dfs(node) {
    color.set(node, GRAY);
    for (const next of all.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        errors++;
        const cycle = [...stack, node, next];
        const start = cycle.indexOf(next);
        const chain = [...cycle.slice(start)].map((n) => n.replace('src/', ''));
        console.error(`❌ [Цикл] ${chain.join(' → ')}`);
      }
      if (c === WHITE) {
        stack.push(node);
        dfs(next);
        stack.pop();
      }
    }
    color.set(node, BLACK);
  }

  for (const node of all.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) dfs(node);
  }
}

console.log('🔍 Запуск проверки архитектуры...');

const files = await findFiles(resolve(ROOT, 'src'));
const processed = await checkBoundaries(files);
console.log('🔄 Поиск циклических зависимостей...');
detectCycles(processed);

if (errors > 0) {
  console.error(`🔥 Найдено ошибок архитектуры: ${errors}`);
  process.exit(1);
} else {
  console.log(`✅ Архитектура в порядке (${processed.length} файлов).`);
}