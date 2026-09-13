import { CompilerAdapter } from '../core/types';
import { compileTsx } from '../compiler/transform';

/**
 * Исходник воркера: тянет Sucrase с esm.sh и выполняет транспиляцию,
 * не блокируя главный поток.
 */
const WORKER_SOURCE = `
self.onmessage = async (event) => {
  const { id, code, filepath } = event.data;
  try {
    const mod = await import('https://esm.sh/sucrase');
    const result = mod.transform(code, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'classic',
      filePath: filepath || 'component.tsx',
    });
    self.postMessage({ id, code: result.code });
  } catch (error) {
    self.postMessage({ id, error: error && error.message ? error.message : String(error) });
  }
};
`;

/** Создаёт inline module-worker (или null, если Worker недоступен). */
export function createCompilerWorker(): Worker | null {
  if (
    typeof Worker === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return null;
  }

  try {
    const blob = new Blob([WORKER_SOURCE], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    return new Worker(url, { type: 'module' });
  } catch {
    return null;
  }
}

interface PendingCall {
  resolve: (code: string) => void;
  reject: (error: Error) => void;
}

/**
 * Адаптер компилятора, выполняющий Sucrase в Web Worker.
 * При отсутствии Worker (Node/SSR/jsdom) прозрачно работает на главном потоке.
 */
export class WorkerCompilerAdapter implements CompilerAdapter {
  readonly name = 'worker-sucrase';
  private worker: Worker | null;
  private sequence = 0;
  private pending = new Map<number, PendingCall>();

  constructor(worker: Worker | null = createCompilerWorker()) {
    this.worker = worker;

    if (this.worker) {
      this.worker.onmessage = (event: MessageEvent) => {
        const { id, code, error } = event.data as {
          id: number;
          code?: string;
          error?: string;
        };
        const call = this.pending.get(id);
        if (!call) return;
        this.pending.delete(id);
        if (error) call.reject(new Error(error));
        else call.resolve(code ?? '');
      };
    }
  }

  public get isWorker(): boolean {
    return this.worker !== null;
  }

  public transform(code: string, filepath = 'component.tsx'): Promise<string> {
    if (!this.worker) {
      return Promise.resolve(compileTsx(code, filepath));
    }

    const id = ++this.sequence;

    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ id, code, filepath });
    });
  }

  public dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
