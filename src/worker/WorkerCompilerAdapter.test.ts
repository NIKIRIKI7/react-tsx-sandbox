import { describe, it, expect } from 'vitest';
import { WorkerCompilerAdapter, createCompilerWorker } from './WorkerCompilerAdapter';

describe('worker/WorkerCompilerAdapter', () => {
  it('без Worker работает на главном потоке (fallback)', async () => {
    const adapter = new WorkerCompilerAdapter(null);

    expect(adapter.isWorker).toBe(false);

    const compiled = await adapter.transform('const value: number = 1; export default value;', 'x.tsx');

    expect(compiled).toContain('const value = 1');
    adapter.dispose();
  });

  it('createCompilerWorker не бросает и возвращает Worker | null', () => {
    const worker = createCompilerWorker();

    expect(worker === null || typeof worker === 'object').toBe(true);
    worker?.terminate();
  });
});
