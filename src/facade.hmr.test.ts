import { describe, it, expect, vi } from 'vitest';
import { SandboxFacade } from './facade';
import { VirtualFileSystem } from './core/types';

function createFakeReact() {
  return {
    createElement: vi.fn((type: any, props: any, ...children: any[]) => ({ type, props, children })),
  };
}

const VFS_A: VirtualFileSystem = {
  '/App.tsx': `
    import { label } from './labels';
    import { theme } from './theme';
    export default function C() {
      return { title: label, theme: theme.name, list: [1, 2].map((n) => n) };
    }
  `,
  '/labels.ts': `export const label = 'one';`,
  '/theme.ts': `export const theme = { name: 'dark' };`,
};

describe('facade.SandboxFacade.hmrUpdate (incremental VFS)', () => {
  it('compiles everything on the first call', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });

    const first = await facade.hmrUpdate(VFS_A);

    expect(first.error).toBeNull();
    expect(first.hmr.changed).toEqual([]);
    expect(first.hmr.removed).toEqual([]);
    expect(first.hmr.recompiled.sort()).toEqual(Object.keys(VFS_A).sort());
    expect(first.hmr.kept).toEqual([]);
    expect(first.component()).toMatchObject({ title: 'one', theme: 'dark' });
  });

  it('recompiles only the changed leaf and its dependents, keeping the rest from cache', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });
    await facade.hmrUpdate(VFS_A);

    const vfsB: VirtualFileSystem = { ...VFS_A, '/labels.ts': `export const label = 'two';` };
    const second = await facade.hmrUpdate(vfsB);

    expect(second.error).toBeNull();
    expect(second.hmr.changed).toEqual(['/labels.ts']);
    expect(second.hmr.recompiled.sort()).toEqual(['/App.tsx', '/labels.ts']);
    expect(second.hmr.kept).toEqual(['/theme.ts']);
    expect(second.component()).toMatchObject({ title: 'two', theme: 'dark' });
  });

  it('recompiles dependents of a changed module (App depends on labels)', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });
    await facade.hmrUpdate(VFS_A);

    // Меняем /labels.ts — зависимый /App.tsx обязан перекомпилироваться.
    const vfsB: VirtualFileSystem = { ...VFS_A, '/labels.ts': `export const label = 'three';` };
    const second = await facade.hmrUpdate(vfsB);

    expect(second.hmr.recompiled.sort()).toEqual(['/App.tsx', '/labels.ts']);
  });

  it('recompiles importers when a module is removed', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });
    await facade.hmrUpdate(VFS_A);

    const vfsB: VirtualFileSystem = {
      '/App.tsx': `
        import { theme } from './theme';
        export default function C() {
          return { theme: theme.name, orphan: true };
        }
      `,
      '/theme.ts': VFS_A['/theme.ts'],
    };
    const second = await facade.hmrUpdate(vfsB);

    expect(second.hmr.removed).toEqual(['/labels.ts']);
    // Удалённый файл не перекомпилируется (его больше нет в VFS), но его импортёры — да.
    expect(second.hmr.recompiled).toEqual(['/App.tsx']);
    expect(second.component()).toMatchObject({ theme: 'dark', orphan: true });
  });

  it('picks up a newly added module imported from an unchanged file', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });
    await facade.hmrUpdate(VFS_A);

    const vfsB: VirtualFileSystem = {
      ...VFS_A,
      '/App.tsx': `
        import { label } from './labels';
        import { theme } from './theme';
        import { badge } from './badge';
        export default function C() {
          return { title: label, theme: theme.name, badge: badge.code };
        }
      `,
      '/badge.ts': `export const badge = { code: 'NEW' };`,
    };
    const second = await facade.hmrUpdate(vfsB);

    expect(second.error).toBeNull();
    expect(second.hmr.added).toEqual(['/badge.ts']);
    expect(second.hmr.recompiled.sort()).toEqual(['/App.tsx', '/badge.ts']);
    expect(second.component()).toMatchObject({ badge: 'NEW' });
  });

  it('preserves component output identity across unchanged leaves', async () => {
    const facade = new SandboxFacade({ react: createFakeReact() });
    const first = await facade.hmrUpdate(VFS_A);

    const vfsB: VirtualFileSystem = { ...VFS_A, '/theme.ts': `export const theme = { name: 'light' };` };
    const second = await facade.hmrUpdate(vfsB);

    expect(second.hmr.changed).toEqual(['/theme.ts']);
    expect(second.hmr.recompiled).toEqual(['/theme.ts', '/App.tsx']);
    expect(first.component()).toMatchObject({ theme: 'dark' });
    expect(second.component()).toMatchObject({ theme: 'light' });
  });
});