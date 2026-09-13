import {
  CompilerAdapter,
  CdnResolver,
  CompileOptions,
  DEFAULT_ENTRY,
  DEFAULT_MAX_ITERATIONS,
  EvaluationResult,
  ModuleRegistry,
  PipelinePlugin,
  SandboxGlobals,
  VirtualFileSystem,
} from './core/types';
import { getErrorPhase } from './core/errors';
import { extractBareImports } from './compiler/analyzer';
import { injectLoopProtection } from './compiler/loop-protect';
import { compileTsx } from './compiler/transform';
import { ModuleCache } from './library-manager/cache';
import { loadMissingModules, ModuleImporter } from './library-manager/loader';
import { executeComponent } from './sandbox/evaluator';

export interface SandboxFacadeOptions {
  compiler?: CompilerAdapter;
  cdnResolver?: CdnResolver;
  importer?: ModuleImporter;
  loopProtect?: boolean;
  maxIterations?: number;
  plugins?: PipelinePlugin[];
}

export class SandboxFacade {
  private cache: ModuleCache;
  private assetsMap: Record<string, string> = {};
  private compiler?: CompilerAdapter;
  private cdnResolver?: CdnResolver;
  private importer?: ModuleImporter;
  private loopProtect: boolean;
  private maxIterations: number;
  private plugins: PipelinePlugin[];

  constructor(
    initialRegistry: ModuleRegistry = {},
    importerOrOptions: ModuleImporter | SandboxFacadeOptions = {},
  ) {
    const options: SandboxFacadeOptions =
      typeof importerOrOptions === 'function' ? { importer: importerOrOptions } : importerOrOptions;

    this.cache = new ModuleCache(initialRegistry);
    this.compiler = options.compiler;
    this.cdnResolver = options.cdnResolver;
    this.importer = options.importer;
    this.loopProtect = options.loopProtect ?? true;
    this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.plugins = options.plugins ?? [];
  }

  public setAssets(assets: Record<string, string>): void {
    this.assetsMap = { ...assets };
  }

  public registerModule(name: string, module: any): void {
    this.cache.register(name, module);
  }

  public async compile(
    input: string | VirtualFileSystem,
    options: CompileOptions = {},
  ): Promise<EvaluationResult> {
    const start = performance.now();
    const signal = options.signal;
    const entry = options.entry ?? DEFAULT_ENTRY;

    const vfs: VirtualFileSystem = typeof input === 'string' ? { [entry]: input } : { ...input };

    try {
      if (signal?.aborted) throw new DOMException('Compilation aborted', 'AbortError');

      // 1. Plugin beforeCompile + loop protection + сбор внешних зависимостей
      const bareImports = new Set<string>();
      const processed: VirtualFileSystem = {};

      for (const [filepath, rawCode] of Object.entries(vfs)) {
        let code = rawCode;

        for (const plugin of this.plugins) {
          if (plugin.beforeCompile) code = await plugin.beforeCompile(code, filepath);
        }

        if (this.loopProtect) code = injectLoopProtection(code, this.maxIterations);

        processed[filepath] = code;
        for (const pkg of extractBareImports(code)) bareImports.add(pkg);
      }

      // 2. Загрузка отсутствующих пакетов (NPM/CDN)
      await loadMissingModules([...bareImports], this.cache, {
        importer: this.importer,
        cdnResolver: this.cdnResolver,
        signal,
      });

      if (signal?.aborted) throw new DOMException('Compilation aborted', 'AbortError');

      // 3. Транспиляция файлов
      const compiledVfs: Record<string, string> = {};

      for (const [filepath, code] of Object.entries(processed)) {
        let compiled = this.compiler
          ? await this.compiler.transform(code, filepath)
          : compileTsx(code, filepath);

        for (const plugin of this.plugins) {
          if (plugin.afterCompile) compiled = await plugin.afterCompile(compiled, filepath);
        }

        compiledVfs[filepath] = compiled;
      }

      // 4. Выполнение в изолированной области
      const globals: SandboxGlobals = {
        staticFile: (filename: string) => this.assetsMap[filename] || '',
      };

      const component = executeComponent(compiledVfs[entry], {
        registry: this.cache.getAll(),
        globals,
        compiledVfs,
        entryPath: entry,
      });

      return {
        component,
        error: null,
        executionTimeMs: performance.now() - start,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        component: null,
        error: err,
        executionTimeMs: performance.now() - start,
        errorPhase: getErrorPhase(err),
      };
    }
  }
}
