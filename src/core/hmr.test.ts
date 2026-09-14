import { describe, it, expect } from 'vitest';
import { diffFiles, buildImportsGraph, getDependents } from './hmr';
import { VirtualFileSystem } from './types';

describe('core/hmr.diffFiles', () => {
  it('reports modified and added files as changed', () => {
    const oldFiles: VirtualFileSystem = {
      '/App.tsx': 'export default () => 1;',
      '/utils.ts': 'export const a = 1;',
    };
    const newFiles: VirtualFileSystem = {
      '/App.tsx': 'export default () => 2;',
      '/utils.ts': 'export const a = 1;',
      '/theme.ts': 'export const theme = "dark";',
    };
    const { changed, removed } = diffFiles(oldFiles, newFiles);

    expect(changed.sort()).toEqual(['/App.tsx', '/theme.ts']);
    expect(removed).toEqual([]);
  });

  it('reports removed files', () => {
    const oldFiles: VirtualFileSystem = { '/App.tsx': 'x', '/gone.ts': 'y' };
    const newFiles: VirtualFileSystem = { '/App.tsx': 'x' };
    const { changed, removed } = diffFiles(oldFiles, newFiles);

    expect(changed).toEqual([]);
    expect(removed).toEqual(['/gone.ts']);
  });

  it('ignores files that only change by equality of content', () => {
    const oldFiles: VirtualFileSystem = { '/App.tsx': 'same' };
    const newFiles: VirtualFileSystem = { '/App.tsx': 'same' };
    const { changed, removed } = diffFiles(oldFiles, newFiles);

    expect(changed).toEqual([]);
    expect(removed).toEqual([]);
  });
});

describe('core/hmr.buildImportsGraph', () => {
  it('resolves local imports, skipping bare packages and self-imports', () => {
    const vfs: VirtualFileSystem = {
      '/App.tsx': `import { helper } from './helper';\nimport React from 'react';\nexport default () => null;`,
      '/helper.ts': 'export const helper = 1;',
      '/host.tsx': "import App from './App'",
    };

    const getLocalImports = (code: string) => {
      if (code.includes('./helper')) return ['./helper'];
      if (code.includes('./App')) return ['./App'];
      return [];
    };

    const resolvePath = (curr: string, rel: string) => {
      if (curr === '/App.tsx' && rel === './helper') return '/helper.ts';
      if (curr === '/host.tsx' && rel === './App') return '/App.tsx';
      return null;
    };

    const graph = buildImportsGraph(vfs, getLocalImports, resolvePath);

    expect(graph['/App.tsx']).toEqual(['/helper.ts']);
    expect(graph['/host.tsx']).toEqual(['/App.tsx']);
    expect(graph['/helper.ts']).toEqual([]);
    expect(Object.values(graph).some((imports) => imports.includes('react'))).toBe(false);
  });

  it('treats a module importing itself as no dependency', () => {
    const vfs: VirtualFileSystem = { '/self.ts': "import { x } from './self';" };
    const getLocalImports = () => ['./self'];
    const resolvePath = () => '/self.ts';
    
    const graph = buildImportsGraph(vfs, getLocalImports, resolvePath);
    expect(graph['/self.ts']).toEqual([]);
  });
});

describe('core/hmr.getDependents', () => {
  it('includes the changed files themselves and transitive dependents', () => {
    const graph = {
      '/leaf.ts': [],
      '/middle.ts': ['/leaf.ts'],
      '/top.ts': ['/middle.ts'],
      '/unrelated.ts': [],
    };

    const dependents = getDependents(['/leaf.ts'], graph);
    expect(dependents.sort()).toEqual(['/leaf.ts', '/middle.ts', '/top.ts']);
  });

  it('returns seeds even when nothing depends on them', () => {
    const graph = { '/leaf.ts': [], '/other.ts': [] };
    expect(getDependents(['/leaf.ts'], graph)).toEqual(['/leaf.ts']);
  });

  it('finds importers of a removed module through its bogus edge', () => {
    const graph = { '/App.tsx': ['/gone.ts'] };
    const dependents = getDependents(['/gone.ts'], graph);
    expect(dependents.sort()).toEqual(['/App.tsx', '/gone.ts']);
  });
});