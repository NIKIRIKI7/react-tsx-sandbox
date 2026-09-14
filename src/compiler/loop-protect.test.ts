import { describe, it, expect } from 'vitest';
import { injectLoopProtection } from './loop-protect';
import { compileTsx } from './transform';

function build(source: string, maxIterations: number) {
  const compiled = compileTsx(injectLoopProtection(source, maxIterations));
  const exports: Record<string, any> = {};
  const require = () => {};
  // Изолированно выполняем код без привязки к evaluator'у песочницы
  const fn = new Function('exports', 'require', compiled);
  fn(exports, require);
  return exports.default;
}

describe('compiler/loop-protect.injectLoopProtection', () => {
  it('прерывает бесконечный while с ExecutionTimeoutError', () => {
    const factory = build(
      `export default function f(){ let i = 0; while (true) { i++; } return i; }`,
      50,
    );

    let caught: unknown;
    try {
      factory();
    } catch (error) {
      caught = error;
    }

    expect((caught as Error).name).toBe('ExecutionTimeoutError');
  });

  it('не мешает обычному for-циклу', () => {
    const factory = build(
      `export default function f(){ let sum = 0; for (let i = 0; i < 5; i++) { sum += i; } return sum; }`,
      1000,
    );
    expect(factory()).toBe(10);
  });

  it('обрабатывает do/while', () => {
    const factory = build(
      `export default function f(){ let i = 0; do { i++; } while (i < 3); return i; }`,
      1000,
    );
    expect(factory()).toBe(3);
  });

  it('идемпотентен (не инжектит защиту дважды)', () => {
    const once = injectLoopProtection(`while (true) {}`, 10);
    expect(injectLoopProtection(once, 10)).toBe(once);
  });

  it('не трогает ключевые слова внутри строк и комментариев', () => {
    const source = `const a = 'for (;;) { }'; // while(true) {}`;
    expect(injectLoopProtection(source, 10)).toBe(source);
  });
});