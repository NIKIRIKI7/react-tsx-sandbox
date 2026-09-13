import { describe, it, expect } from 'vitest';
import { scanImports, resolveVfsPath } from './analyzer';

describe('compiler/analyzer.scanImports', () => {
  it('игнорирует импорты в комментариях', () => {
    const code = `
      // import fake from 'fake-comment'
      /* import another from 'fake-block' */
      import React from 'react';
      import { x } from './local';
    `;

    const result = scanImports(code);

    expect(result.bareImports).toEqual(['react']);
    expect(result.localImports).toEqual(['./local']);
  });

  it('извлекает статические и динамические импорты', () => {
    const code = `
      import { range } from 'd3';
      const three = import('three');
      const local = import('./chunk');
    `;

    const result = scanImports(code);

    expect(result.bareImports.sort()).toEqual(['d3', 'three']);
    expect(result.dynamicImports.sort()).toEqual(['./chunk', 'three']);
  });

  it('различает bare-пакеты и локальные пути', () => {
    const result = scanImports(`
      import a from '@scope/pkg';
      import b from 'lodash/fp';
      import c from '../up';
      import d from '/absolute';
    `);

    expect(result.bareImports.sort()).toEqual(['@scope/pkg', 'lodash/fp']);
    expect(result.localImports.sort()).toEqual(['../up', '/absolute']);
  });
});

describe('compiler/analyzer.resolveVfsPath', () => {
  const vfs = {
    '/App.tsx': '',
    '/Button.tsx': '',
    '/components/Card.tsx': '',
    '/components/index.ts': '',
  };

  it('резолвит относительный путь с расширением', () => {
    expect(resolveVfsPath('/App.tsx', './Button', vfs)).toBe('/Button.tsx');
  });

  it('резолвит вложенный путь', () => {
    expect(resolveVfsPath('/App.tsx', './components/Card', vfs)).toBe('/components/Card.tsx');
  });

  it('резолвит ../', () => {
    expect(resolveVfsPath('/components/Card.tsx', '../Button', vfs)).toBe('/Button.tsx');
  });

  it('резолвит index-файл', () => {
    expect(resolveVfsPath('/App.tsx', './components', vfs)).toBe('/components/index.ts');
  });

  it('возвращает null для отсутствующего файла', () => {
    expect(resolveVfsPath('/App.tsx', './Missing', vfs)).toBeNull();
  });
});
