/**
 * Унифицированная плагинная система onResolve/onLoad.
 * Аналог: `esbuild/pkg/api/api.go` и `internal/bundler/bundler.go`.
 *
 * Плагин маршрутизирует импорты (namespace) и загружает/трансформирует
 * виртуальные модули (CSS, SVG, ZIP-ассеты) вместо текстовых wrapper-хаков.
 */
import { CompileOptions, VirtualFileSystem } from './types';

/** Спецификатор виртуального модуля Tailwind, автоматически подключаемого фасадом. */
export const TAILWIND_VIRTUAL_MODULE = 'virtual:tailwind.css';

export interface OnResolveArgs {
  path: string;
  importer: string;
  namespace: string;
}

export interface OnResolveResult {
  path?: string;
  namespace?: string;
  external?: boolean;
}

export interface OnLoadArgs {
  path: string;
  namespace: string;
  /** Текущая VFS, для сбора кандидатов и чтения исходников. */
  vfs?: VirtualFileSystem;
}

export interface OnLoadResult {
  contents: string | Uint8Array;
  loader: 'js' | 'jsx' | 'ts' | 'tsx' | 'css' | 'json' | 'text' | 'dataurl';
}

export interface PluginBuild {
  onResolve(
    options: { filter: RegExp; namespace?: string },
    callback: (
      args: OnResolveArgs,
    ) => OnResolveResult | Promise<OnResolveResult | null | undefined> | null | undefined,
  ): void;

  onLoad(
    options: { filter: RegExp; namespace?: string },
    callback: (
      args: OnLoadArgs,
    ) => OnLoadResult | Promise<OnLoadResult | null | undefined> | null | undefined,
  ): void;

  initialOptions: CompileOptions;
}

export interface SandboxPlugin {
  name: string;
  setup(build: PluginBuild): void | Promise<void>;
}

export interface ResolvedModuleData {
  contents: string;
  loader: OnLoadResult['loader'];
}

interface ResolveHook {
  filter: RegExp;
  namespace?: string;
  callback: (args: OnResolveArgs) => unknown;
}

interface LoadHook {
  filter: RegExp;
  namespace?: string;
  callback: (args: OnLoadArgs) => unknown;
}

/**
 * Исполняет плагины компиляции в детерминированном порядке пространств имён.
 */
export class PluginPipeline {
  private resolveHooks: ResolveHook[] = [];
  private loadHooks: LoadHook[] = [];

  constructor(private readonly plugins: SandboxPlugin[]) {}

  public async init(initialOptions: CompileOptions): Promise<void> {
    for (const plugin of this.plugins) {
      const build: PluginBuild = {
        initialOptions,
        onResolve: (opts, cb) => {
          this.resolveHooks.push({ filter: opts.filter, namespace: opts.namespace, callback: cb });
        },
        onLoad: (opts, cb) => {
          this.loadHooks.push({ filter: opts.filter, namespace: opts.namespace, callback: cb });
        },
      };
      await plugin.setup(build);
    }
  }

  public async runResolve(
    path: string,
    importer: string,
    namespace = 'file',
  ): Promise<OnResolveResult> {
    for (const hook of this.resolveHooks) {
      if (hook.namespace && hook.namespace !== namespace) continue;
      if (hook.filter.test(path)) {
        const res = await hook.callback({ path, importer, namespace });
        if (res) return res as OnResolveResult;
      }
    }
    return { path, namespace };
  }

  public async runLoad(
    path: string,
    namespace = 'file',
    vfs?: VirtualFileSystem,
  ): Promise<ResolvedModuleData | null> {
    for (const hook of this.loadHooks) {
      if (hook.namespace && hook.namespace !== namespace) continue;
      if (hook.filter.test(path)) {
        const res = await hook.callback({ path, namespace, vfs });
        if (res) {
          const result = res as OnLoadResult;
          const contents =
            typeof result.contents === 'string'
              ? result.contents
              : new TextDecoder().decode(result.contents);
          return { contents, loader: result.loader };
        }
      }
    }
    return null;
  }
}