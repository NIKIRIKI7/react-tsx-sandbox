import { VirtualFileSystem } from './types';
import { hashString } from './hash';

export interface HmrChanges {
  changed: string[];
  removed: string[];
  added: string[];
}

/**
 * Сравнение двух ревизий VFS по содержимому (строковое).
 * Поддерживает обратную совместимость: вновь добавленные файлы попадают
 * в `changed` (как и раньше) и дополнительно дублируются в `added`.
 */
export function diffFiles(oldFiles: VirtualFileSystem, newFiles: VirtualFileSystem): HmrChanges {
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const [path, content] of Object.entries(newFiles)) {
    if (Object.prototype.hasOwnProperty.call(oldFiles, path)) {
      if (oldFiles[path] !== content) changed.push(path);
    } else {
      changed.push(path);
      added.push(path);
    }
  }

  for (const path of Object.keys(oldFiles)) {
    if (!Object.prototype.hasOwnProperty.call(newFiles, path)) removed.push(path);
  }

  return { changed, removed, added };
}

/**
 * Быстрое сравнение двух ревизий VFS через 64-битные FNV-хэши содержимого —
 * без построения мегабайтных промежуточных строк (аналог Merkle-tree из esbuild).
 *
 * `changed` содержит только модифицированные файлы, `added` — новые,
 * `removed` — удалённые. Сравнение двух номеров вместо содержимого делает
 * дифф O(1) по стоимости на файл и снимает нагрузку с GC в React-хуках.
 */
export function diffFilesWithHashes(
  oldFiles: VirtualFileSystem,
  newFiles: VirtualFileSystem,
  oldHashes: Map<string, string>,
): { changes: HmrChanges; newHashes: Map<string, string> } {
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const newHashes = new Map<string, string>();

  for (const [path, content] of Object.entries(newFiles)) {
    const currentHash = hashString(content);
    newHashes.set(path, currentHash);

    const prevHash = oldHashes.get(path);
    if (prevHash === undefined) {
      added.push(path);
    } else if (prevHash !== currentHash) {
      changed.push(path);
    }
  }

  for (const path of Object.keys(oldFiles)) {
    if (!Object.prototype.hasOwnProperty.call(newFiles, path)) removed.push(path);
  }

  return { changes: { changed, added, removed }, newHashes };
}

export interface DependencyGraph {
  /** file -> set of files it imports. */
  dependencies: Map<string, Set<string>>;
  /** file -> set of files that import it. */
  dependents: Map<string, Set<string>>;
}

/**
 * Строит двунаправленный граф зависимостей VFS.
 * `dependents` — обратные рёбра, по которым распространяется волна
 * инвалидации при изменении листового модуля.
 */
export function buildDependencyGraph(
  vfs: VirtualFileSystem,
  getLocalImports: (code: string) => string[],
  resolvePath: (currentFile: string, specifier: string, vfs: VirtualFileSystem) => string | null,
): DependencyGraph {
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const filepath of Object.keys(vfs)) {
    dependencies.set(filepath, new Set());
    if (!dependents.has(filepath)) dependents.set(filepath, new Set());
  }

  for (const [filepath, code] of Object.entries(vfs)) {
    const fileDeps = dependencies.get(filepath)!;
    for (const specifier of getLocalImports(code)) {
      const resolved = resolvePath(filepath, specifier, vfs);
      if (resolved && resolved !== filepath) {
        fileDeps.add(resolved);

        let reverse = dependents.get(resolved);
        if (!reverse) {
          reverse = new Set();
          dependents.set(resolved, reverse);
        }
        reverse.add(filepath);
      }
    }
  }

  return { dependencies, dependents };
}

/**
 * Безопасный поиск всех зависимых модулей с защитой от циклов.
 *
 * Трёхцветная раскраска (White-Gray-Black DFS), как в `enforceNoCyclicChunkImports`
 * у esbuild: посещённые узлы не переобрабатываются, поэтому циклы в графе
 * импортов не приводят к `Maximum call stack size exceeded`.
 */
export function getAffectedDependents(
  seeds: readonly string[],
  graph: DependencyGraph,
): string[] {
  const affected = new Set<string>();
  const visited = new Set<string>();

  function dfs(current: string): void {
    if (visited.has(current)) return;
    visited.add(current);
    affected.add(current);

    const directDependents = graph.dependents.get(current);
    if (directDependents) {
      for (const parent of directDependents) {
        dfs(parent);
      }
    }
  }

  for (const seed of seeds) dfs(seed);
  return Array.from(affected);
}

export function buildImportsGraph(
  vfs: VirtualFileSystem,
  getLocalImports: (code: string) => string[],
  resolvePath: (currentFile: string, relativePath: string, vfs: VirtualFileSystem) => string | null
): Record<string, string[]> {
  const graph: Record<string, string[]> = {};

  for (const [filepath, code] of Object.entries(vfs)) {
    const resolved: string[] = [];
    for (const specifier of getLocalImports(code)) {
      const target = resolvePath(filepath, specifier, vfs);
      if (target && target !== filepath) resolved.push(target);
    }
    graph[filepath] = resolved;
  }

  return graph;
}

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