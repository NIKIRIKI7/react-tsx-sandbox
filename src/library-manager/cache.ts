import { ModuleRegistry } from '../core/types';

// Singleton-хранилище в памяти для кэширования библиотек
export class ModuleCache {
  private registry: ModuleRegistry = {};

  public register(name: string, module: any) {
    this.registry[name] = module;
  }

  public get(name: string): any | undefined {
    return this.registry[name];
  }

  public getAll(): ModuleRegistry {
    return { ...this.registry };
  }

  public has(name: string): boolean {
    return !!this.registry[name];
  }
}
