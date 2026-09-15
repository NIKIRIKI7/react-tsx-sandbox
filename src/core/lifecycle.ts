/**
 * Токен отмены и реестр ресурсов сеанса рендера.
 * Аналог: `esbuild/internal/config/config.go` (CancelFlag) и `internal/helpers/waitgroup.go`.
 */

/**
 * Токен отмены долгоживущих операций компиляции и фонового экспорта.
 * Предотвращает гонки состояний: устаревшие промисы не перезаписывают
 * результат более свежей правки пользователя.
 */
export class CancellationToken {
  private cancelled = false;
  private callbacks = new Set<() => void>();

  public get isCancelled(): boolean {
    return this.cancelled;
  }

  public cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const cb of this.callbacks) {
      try {
        cb();
      } catch (e) {
        console.error('[CancellationToken error]', e);
      }
    }
    this.callbacks.clear();
  }

  public onCancel(callback: () => void): () => void {
    if (this.cancelled) {
      callback();
      return () => {};
    }
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public throwIfCancelled(): void {
    if (this.cancelled) {
      const err = new Error('Операция была отменена токеном отмены.');
      err.name = 'AbortError';
      throw err;
    }
  }

  public static fromSignal(signal?: AbortSignal): CancellationToken {
    const token = new CancellationToken();
    if (signal) {
      if (signal.aborted) {
        token.cancel();
      } else {
        signal.addEventListener('abort', () => token.cancel(), { once: true });
      }
    }
    return token;
  }
}

/**
 * Реестр ресурсов, привязанных к текущему сеансу рендера (renderId).
 * Позволяет детерминированно очищать WebGL/AudioContext/таймеры при смене
 * кадра или получении нового HMR-патча.
 */
export class RenderResourceManager {
  private activeDisposers = new Map<number, Set<() => void>>();
  private currentRenderId = 0;

  public nextRenderId(): number {
    this.currentRenderId++;
    this.activeDisposers.set(this.currentRenderId, new Set());
    return this.currentRenderId;
  }

  public register(renderId: number, dispose: () => void): void {
    const set = this.activeDisposers.get(renderId);
    if (set) {
      set.add(dispose);
    } else {
      // Сессия уже мертва, очищаем сразу.
      dispose();
    }
  }

  public disposeRender(renderId: number): void {
    const set = this.activeDisposers.get(renderId);
    if (set) {
      for (const cleanup of set) {
        try {
          cleanup();
        } catch (e) {
          console.warn('[ResourceManager cleanup error]', e);
        }
      }
      this.activeDisposers.delete(renderId);
    }
  }

  public disposeAll(): void {
    for (const id of Array.from(this.activeDisposers.keys())) {
      this.disposeRender(id);
    }
  }
}