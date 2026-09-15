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
import {
  buildDependencyGraph,
  diffFilesWithHashes,
  getAffectedDependents,
} from './core/hmr';
import { computeVfsHashes } from './core/hash';
import { ModuleCache } from './library-manager/cache';
import { loadMissingModules, ModuleImporter } from './library-manager/loader';
import { executeComponent } from './sandbox/evaluator';
import { extractSceneMetadata } from './core/scene-metadata';
import { CancellationToken, RenderResourceManager } from './core/lifecycle';
import { RawSourceMapConsumer, remapStackTrace } from './core/diagnostics';
import { PluginPipeline, SandboxPlugin, TAILWIND_VIRTUAL_MODULE } from './core/plugin';

export interface SandboxFacadeOptions {
  compiler?: CompilerAdapter;
  cdnResolver?: CdnResolver;
  importer?: ModuleImporter;
  loopProtect?: boolean;
  maxIterations?: number;
  /** Плагины: классические PipelinePlugin (before/after) или SandboxPlugin (onResolve/onLoad). */
  plugins?: (PipelinePlugin | SandboxPlugin)[];
}

/** Является ли файл компилируемым исходником (TS/TSX/JS/JSX). JSON и прочие ресурсы не компилируются. */
function isCodeFile(filepath: string): boolean {
  return /\.([cm]?[jt]sx?)$/.test(filepath);
}

function isSandboxPlugin(plugin: PipelinePlugin | SandboxPlugin): plugin is SandboxPlugin {
  return typeof (plugin as SandboxPlugin).setup === 'function';
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
  private pipeline: PluginPipeline;
  private resourceManager = new RenderResourceManager();
  private sourceMaps = new Map<string, RawSourceMapConsumer>();
  private hmrState:
    | {
        lastVfs: VirtualFileSystem;
        fileHashes: Map<string, string>;
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
    const allPlugins = options.plugins ?? [];
    this.plugins = allPlugins.filter((p) => !isSandboxPlugin(p)) as PipelinePlugin[];
    this.pipeline = new PluginPipeline(allPlugins.filter(isSandboxPlugin));
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
    const token = CancellationToken.fromSignal(options.signal);
    const entry = options.entry ?? DEFAULT_ENTRY;

    const vfs: VirtualFileSystem = typeof input === 'string' ? { [entry]: input } : { ...input };
    const renderId = this.resourceManager.nextRenderId();
    token.onCancel(() => this.resourceManager.disposeRender(renderId));

    try {
      token.throwIfCancelled();
      await this.pipeline.init(options);

      // 1. Plugin beforeCompile + loop protection + сбор внешних зависимостей
      const bareImports = new Set<string>();
      const processed: VirtualFileSystem = {};

      for (const [filepath, rawCode] of Object.entries(vfs)) {
        if (!isCodeFile(filepath)) continue;

        let code = await this.processCode(rawCode, filepath);

        processed[filepath] = code;
        for (const pkg of extractBareImports(code)) bareImports.add(pkg);
      }

      // Автоматическое подключение Tailwind: если плагин резолвит virtual:tailwind.css,
      // дописываем импорт в точку входа — пользователю не нужно импортировать его вручную.
      if (!bareImports.has(TAILWIND_VIRTUAL_MODULE)) {
        const twResolve = await this.pipeline.runResolve(TAILWIND_VIRTUAL_MODULE, entry);
        if (twResolve.namespace && twResolve.namespace !== 'file') {
          const entryCode = processed[entry] ?? '';
          if (!entryCode.includes(TAILWIND_VIRTUAL_MODULE)) {
            processed[entry] = `import '${TAILWIND_VIRTUAL_MODULE}';\n${entryCode}`;
          }
          bareImports.add(TAILWIND_VIRTUAL_MODULE);
        }
      }

      token.throwIfCancelled();

      // 2. Виртуальные модули через onResolve/onLoad плагины (CSS, asset, text).
      const virtualCompiled: Record<string, string> = {};
      for (const specifier of [...bareImports]) {
        const resolved = await this.pipeline.runResolve(specifier, entry);
        if (resolved.namespace && resolved.namespace !== 'file') {
          const data = await this.pipeline.runLoad(resolved.path ?? specifier, resolved.namespace, vfs);
          if (data) {
            virtualCompiled[specifier] = data.loader === 'css' || data.loader === 'text'
              ? `module.exports = ${JSON.stringify(data.contents)};`
              : data.contents;
          }
        }
      }

      // 3. Загрузка отсутствующих пакетов (NPM/CDN)
      const realBareImports = [...bareImports].filter((pkg) => !virtualCompiled[pkg]);
      await loadMissingModules(realBareImports, this.cache, {
        importer: this.importer,
        cdnResolver: this.cdnResolver,
        signal: options.signal,
      });

      token.throwIfCancelled();

      // 4. Транспиляция файлов
      const compiledVfs: Record<string, string> = { ...virtualCompiled };
      this.sourceMaps.clear();

      for (const [filepath, code] of Object.entries(processed)) {
        const compiled = await this.transformCode(code, filepath);
        compiledVfs[filepath] = compiled;
        // Идентичная карта: сгенерированная строка соответствует исходной 1:1.
        this.sourceMaps.set(filepath, new RawSourceMapConsumer({ sources: [filepath], mappings: 'AAAA;' }));
      }

      // 5. Выполнение в изолированной области
      const globals = this.buildGlobals();

      const component = executeComponent(compiledVfs[entry], {
        registry: this.cache.getAll(),
        globals,
        compiledVfs,
        entryPath: entry,
      });

      const rootExports = (component as any)?.__moduleExports;
      const metadata = extractSceneMetadata(input, rootExports, component);

      return {
        component,
        error: null,
        executionTimeMs: performance.now() - start,
        metadata,
        exports: rootExports,
      };
    } catch (rawError) {
      const err = rawError instanceof Error ? rawError : new Error(String(rawError));

      if (err.stack) {
        try {
          err.stack = remapStackTrace(err.stack, this.sourceMaps, vfs);
        } catch {
          // Ремаппинг диагностики не должен маскировать исходную ошибку.
        }
      }

      return {
        component: null,
        error: err,
        executionTimeMs: performance.now() - start,
        errorPhase: getErrorPhase(err),
        // JSON-сцена может не компилироваться как TSX — но её параметры всё равно извлекаем
        metadata: extractSceneMetadata(input),
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
    const token = CancellationToken.fromSignal(options.signal);
    const entry = options.entry ?? DEFAULT_ENTRY;
    const vfs: VirtualFileSystem = { ...input };
    const hmr: HmrEvent = { changed: [], added: [], removed: [], recompiled: [], kept: [] };

    try {
      token.throwIfCancelled();
      await this.pipeline.init(options);

      const previous = this.hmrState;

      if (!previous) {
        // Первый вызов — полная компиляция как в `compile`, но с сохранением кэша.
        hmr.added = Object.keys(vfs);
        hmr.recompiled = Object.keys(vfs);

        const processed: Record<string, string> = {};
        const compiledVfs: Record<string, string> = {};
        const bareImports = new Set<string>();

        for (const [filepath, rawCode] of Object.entries(vfs)) {
          if (!isCodeFile(filepath)) continue;

          const code = await this.processCode(rawCode, filepath);
          processed[filepath] = code;
          compiledVfs[filepath] = await this.transformCode(code, filepath);
          for (const pkg of extractBareImports(code)) bareImports.add(pkg);
        }

        // Автоматическое подключение Tailwind (см. compile).
        if (!bareImports.has(TAILWIND_VIRTUAL_MODULE)) {
          const twResolve = await this.pipeline.runResolve(TAILWIND_VIRTUAL_MODULE, entry);
          if (twResolve.namespace && twResolve.namespace !== 'file') {
            const entryCode = processed[entry] ?? '';
            if (!entryCode.includes(TAILWIND_VIRTUAL_MODULE)) {
              processed[entry] = `import '${TAILWIND_VIRTUAL_MODULE}';\n${entryCode}`;
              compiledVfs[entry] = await this.transformCode(processed[entry], entry);
            }
            bareImports.add(TAILWIND_VIRTUAL_MODULE);
          }
        }

        token.throwIfCancelled();

        await loadMissingModules([...bareImports], this.cache, {
          importer: this.importer,
          cdnResolver: this.cdnResolver,
          signal: options.signal,
        });

        const component = executeComponent(compiledVfs[entry], {
          registry: this.cache.getAll(),
          globals: this.buildGlobals(),
          compiledVfs,
          entryPath: entry,
        });

const firstHashes = computeVfsHashes(vfs).fileHashes;
        this.hmrState = { lastVfs: vfs, fileHashes: firstHashes, processed, compiled: compiledVfs };

        const rootExports1 = (component as any)?.__moduleExports;
        const metadata1 = extractSceneMetadata(vfs, rootExports1, component);

        return { component, error: null, executionTimeMs: performance.now() - start, hmr, metadata: metadata1, exports: rootExports1 };
      }

      // Инкрементальный путь: хэш-дифф + граф зависимостей
      const { changes, newHashes } = diffFilesWithHashes(
        previous.lastVfs,
        vfs,
        previous.fileHashes,
      );
      hmr.changed = changes.changed;
      hmr.added = changes.added;
      hmr.removed = changes.removed;

      token.throwIfCancelled();

      const nextGraph = buildDependencyGraph(
        vfs,
        (code) => scanImports(code).localImports,
        resolveVfsPath,
      );

      const affected = getAffectedDependents(
        [...changes.changed, ...changes.removed, ...changes.added],
        nextGraph,
      );
      const recompileSet = new Set(
        affected.filter(
          (filepath) =>
            isCodeFile(filepath) && Object.prototype.hasOwnProperty.call(vfs, filepath),
        ),
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

      // Перегенерируем виртуальные модули (Tailwind CSS) — классы могли измениться.
      for (const specifier of [...bareImports]) {
        if (Object.prototype.hasOwnProperty.call(compiledVfs, specifier)) {
          const resolved = await this.pipeline.runResolve(specifier, entry);
          if (resolved.namespace && resolved.namespace !== 'file') {
            const data = await this.pipeline.runLoad(resolved.path ?? specifier, resolved.namespace, vfs);
            if (data) {
              compiledVfs[specifier] = data.loader === 'css' || data.loader === 'text'
                ? `module.exports = ${JSON.stringify(data.contents)};`
                : data.contents;
            }
          }
        }
      }

      await loadMissingModules([...bareImports], this.cache, {
        importer: this.importer,
        cdnResolver: this.cdnResolver,
        signal: options.signal,
      });

      const component = executeComponent(compiledVfs[entry], {
        registry: this.cache.getAll(),
        globals: this.buildGlobals(),
        compiledVfs,
        entryPath: entry,
      });

      this.hmrState = { lastVfs: vfs, fileHashes: newHashes, processed, compiled: compiledVfs };

      const rootExports2 = (component as any)?.__moduleExports;
      const metadata2 = extractSceneMetadata(vfs, rootExports2, component);

      return { component, error: null, executionTimeMs: performance.now() - start, hmr, metadata: metadata2, exports: rootExports2 };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        component: null,
        error: err,
        executionTimeMs: performance.now() - start,
        errorPhase: getErrorPhase(err),
        hmr,
        metadata: extractSceneMetadata(vfs),
      };
    }
  }

  /** Освобождает все зарегистрированные ресурсы рендера (WebGL/Audio/таймеры). */
  public dispose(): void {
    this.resourceManager.disposeAll();
    this.cache.clear();
  }
}
