import {
  CompilerAdapter,
  CdnResolver,
  CompileOptions,
  DEFAULT_ENTRY,
  DEFAULT_MAX_ITERATIONS,
  EvaluationResult,
  HmrEvent,
  HmrUpdateResult,
  ModuleRegistry,
  PipelinePlugin,
  SandboxGlobals,
  VirtualFileSystem,
} from './core/types';
import { getErrorPhase } from './core/errors';
import { extractBareImports, scanImports, resolveVfsPath } from './compiler/analyzer';
import { injectLoopProtection } from './compiler/loop-protect';
import { compileTsx } from './compiler/transform';
import { buildImportsGraph, getDependents } from './core/hmr';
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
  private hmrState:
    | {
        lastVfs: VirtualFileSystem;
        processed: Record<string, string>;
        compiled: Record<string, string>;
      }
    | undefined;

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

  /** Прогоняет файл через плагины (beforeCompile) и защиту от бесконечных циклов. */
  private async processCode(code: string, filepath: string): Promise<string> {
    for (const plugin of this.plugins) {
      if (plugin.beforeCompile) code = await plugin.beforeCompile(code, filepath);
    }
    if (this.loopProtect) code = injectLoopProtection(code, this.maxIterations);
    return code;
  }

  /** Компилирует обработанный файл и прогоняет через плагины (afterCompile). */
  private async transformCode(processedCode: string, filepath: string): Promise<string> {
    let compiled = this.compiler
      ? await this.compiler.transform(processedCode, filepath)
      : compileTsx(processedCode, filepath);

    for (const plugin of this.plugins) {
      if (plugin.afterCompile) compiled = await plugin.afterCompile(compiled, filepath);
    }

    return compiled;
  }

  private buildGlobals(): SandboxGlobals {
    return {
      staticFile: (filename: string) => this.assetsMap[filename] || '',
    };
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
        let code = await this.processCode(rawCode, filepath);

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
        compiledVfs[filepath] = await this.transformCode(code, filepath);
      }

      // 4. Выполнение в изолированной области
      const globals = this.buildGlobals();

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

  /**
   * Инкрементальная перекомпиляция VFS (HMR).
   *
   * Сравнивает новую VFS с предыдущей, перекомпилирует только изменённые файлы
   * и их транзитивных зависимых, остальные берёт из кэша. Возвращает результат
   * оценки (тот же, что `compile`) плюс сводку `hmr`.
   */
  public async hmrUpdate(
    input: VirtualFileSystem,
    options: CompileOptions = {},
  ): Promise<HmrUpdateResult> {
    const start = performance.now();
    const signal = options.signal;
    const entry = options.entry ?? DEFAULT_ENTRY;
    const vfs: VirtualFileSystem = { ...input };
    const hmr: HmrEvent = { changed: [], added: [], removed: [], recompiled: [], kept: [] };

    try {
      if (signal?.aborted) throw new DOMException('Compilation aborted', 'AbortError');

      const previous = this.hmrState;

      if (!previous) {
        // Первый вызов — полная компиляция как в `compile`, но с сохранением кэша.
        hmr.added = Object.keys(vfs);
        hmr.recompiled = Object.keys(vfs);

        const processed: Record<string, string> = {};
        const compiledVfs: Record<string, string> = {};
        const bareImports = new Set<string>();

        for (const [filepath, rawCode] of Object.entries(vfs)) {
          const code = await this.processCode(rawCode, filepath);
          processed[filepath] = code;
          compiledVfs[filepath] = await this.transformCode(code, filepath);
          for (const pkg of extractBareImports(code)) bareImports.add(pkg);
        }

        if (signal?.aborted) throw new DOMException('Compilation aborted', 'AbortError');

        await loadMissingModules([...bareImports], this.cache, {
          importer: this.importer,
          cdnResolver: this.cdnResolver,
          signal,
        });

        const component = executeComponent(compiledVfs[entry], {
          registry: this.cache.getAll(),
          globals: this.buildGlobals(),
          compiledVfs,
          entryPath: entry,
        });

        this.hmrState = { lastVfs: vfs, processed, compiled: compiledVfs };

        return { component, error: null, executionTimeMs: performance.now() - start, hmr };
      }

      // Инкрементальный путь: дифф + граф зависимостей
      const changedSet = new Set<string>();
      for (const [filepath, content] of Object.entries(vfs)) {
        if (!Object.prototype.hasOwnProperty.call(previous.lastVfs, filepath)) {
          hmr.added.push(filepath);
          changedSet.add(filepath);
        } else if (previous.lastVfs[filepath] !== content) {
          hmr.changed.push(filepath);
          changedSet.add(filepath);
        }
      }
      for (const filepath of Object.keys(previous.lastVfs)) {
        if (!Object.prototype.hasOwnProperty.call(vfs, filepath)) hmr.removed.push(filepath);
      }

      if (signal?.aborted) throw new DOMException('Compilation aborted', 'AbortError');

      const nextGraph = buildImportsGraph(
        vfs,
        (code) => scanImports(code).localImports,
        resolveVfsPath
      );
      
      const affected = getDependents([...changedSet, ...hmr.removed], nextGraph);
      const recompileSet = new Set(
        affected.filter((filepath) => Object.prototype.hasOwnProperty.call(vfs, filepath)),
      );

      hmr.recompiled = [...recompileSet];
      hmr.kept = Object.keys(vfs).filter((filepath) => !recompileSet.has(filepath));

      const processed = { ...previous.processed };
      const compiledVfs = { ...previous.compiled };

      for (const filepath of recompileSet) {
        const code = await this.processCode(vfs[filepath], filepath);
        processed[filepath] = code;
        compiledVfs[filepath] = await this.transformCode(code, filepath);
      }

      for (const filepath of hmr.removed) {
        delete processed[filepath];
        delete compiledVfs[filepath];
      }

      const bareImports = new Set<string>();
      for (const code of Object.values(processed)) {
        for (const pkg of extractBareImports(code)) bareImports.add(pkg);
      }
      await loadMissingModules([...bareImports], this.cache, {
        importer: this.importer,
        cdnResolver: this.cdnResolver,
        signal,
      });

      const component = executeComponent(compiledVfs[entry], {
        registry: this.cache.getAll(),
        globals: this.buildGlobals(),
        compiledVfs,
        entryPath: entry,
      });

      this.hmrState = { lastVfs: vfs, processed, compiled: compiledVfs };

      return { component, error: null, executionTimeMs: performance.now() - start, hmr };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        component: null,
        error: err,
        executionTimeMs: performance.now() - start,
        errorPhase: getErrorPhase(err),
        hmr,
      };
    }
  }
}
