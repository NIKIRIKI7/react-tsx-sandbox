import { ModuleRegistry, SandboxGlobals, EvaluationResult } from './core/types';
import { extractBareImports } from './compiler/analyzer';
import { compileTsx } from './compiler/transform';
import { ModuleCache } from './library-manager/cache';
import { loadMissingModules, ModuleImporter } from './library-manager/loader';
import { executeComponent } from './sandbox/evaluator';

export class SandboxFacade {
  private cache: ModuleCache;
  private assetsMap: Record<string, string>;
  private importer?: ModuleImporter;

  constructor(initialRegistry: ModuleRegistry = {}, importer?: ModuleImporter) {
    this.cache = new ModuleCache();
    this.assetsMap = {};
    this.importer = importer;

    // Предварительно регистрируем базовые библиотеки (React, Remotion)
    Object.entries(initialRegistry).forEach(([name, module]) => {
      this.cache.register(name, module);
    });
  }

  public setAssets(assets: Record<string, string>) {
    this.assetsMap = assets;
  }

  public async compile(rawTsx: string): Promise<EvaluationResult> {
    const start = performance.now();

    try {
      // 1. Анализ
      const requiredPackages = extractBareImports(rawTsx);

      // 2. Загрузка зависимостей (NPM/CDN)
      await loadMissingModules(requiredPackages, this.cache, this.importer);

      // 3. Транспиляция
      const jsCode = compileTsx(rawTsx);

      // 4. Подготовка глобальной области видимости
      const globals: SandboxGlobals = {
        staticFile: (filename: string) => this.assetsMap[filename] || '',
      };

      // 5. Выполнение
      const component = executeComponent(jsCode, this.cache.getAll(), globals);

      return {
        component,
        error: null,
        executionTimeMs: performance.now() - start,
      };
    } catch (error) {
      return {
        component: null,
        error: error as Error,
        executionTimeMs: performance.now() - start,
      };
    }
  }
}
