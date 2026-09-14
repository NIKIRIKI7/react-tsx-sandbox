import { VirtualFileSystem } from './types';
import { scanImports, resolveVfsPath } from '../compiler/analyzer';

export interface HmrChanges {
  changed: string[];
  removed: string[];
}

/** Сравнивает два состояния VFS и возвращает изменённые/удалённые файлы. */
export function diffFiles(oldFiles: VirtualFileSystem, newFiles: VirtualFileSystem): HmrChanges {
  const changed: string[] = [];
  const removed: string[] = [];

  for (const [path, content] of Object.entries(newFiles)) {
    if (Object.prototype.hasOwnProperty.call(oldFiles, path)) {
      if (oldFiles[path] !== content) changed.push(path);
    } else {
      changed.push(path);
    }
  }

  for (const path of Object.keys(oldFiles)) {
    if (!Object.prototype.hasOwnProperty.call(newFiles, path)) removed.push(path);
  }

  return { changed, removed };
}

/**
 * Строит граф зависимостей VFS: файл -> разрешённые локальные импорты.
 * Внешние (bare) пакеты исключаются.
 */
export function buildImportsGraph(vfs: VirtualFileSystem): Record<string, string[]> {
  const graph: Record<string, string[]> = {};

  for (const [filepath, code] of Object.entries(vfs)) {
    const resolved: string[] = [];
    for (const specifier of scanImports(code).localImports) {
      const target = resolveVfsPath(filepath, specifier, vfs);
      if (target && target !== filepath) resolved.push(target);
    }
    graph[filepath] = resolved;
  }

  return graph;
}

/**
 * Возвращает все файлы, которые (транзитивно) зависят от изменившихся.
 * Включает в себя сами `changedFiles` — это множество и есть HMR-boundary.
 */
export function getDependents(
  changedFiles: string[],
  importsGraph: Record<string, string[]>,
): string[] {
  const seeds = [...changedFiles];
  const dependents = new Set<string>(seeds.map((file) => file));
  let grew = true;

  while (grew) {
    grew = false;
    for (const [file, imports] of Object.entries(importsGraph)) {
      if (!dependents.has(file) && imports.some((imported) => dependents.has(imported))) {
        dependents.add(file);
        grew = true;
      }
    }
  }

  return Array.from(dependents);
}