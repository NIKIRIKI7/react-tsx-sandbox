import { describe, it, expect } from 'vitest';
import { compileTsx, cleanMarkdownFences } from './transform';
import { CompilerError } from '../core/errors';

describe('compiler/transform: ошибки с координатами', () => {
  it('сообщает line/column и snippet для синтаксической ошибки', () => {
    let caught: CompilerError | undefined;

    try {
      compileTsx('const = ;');
    } catch (error) {
      caught = error as CompilerError;
    }

    expect(caught).toBeInstanceOf(CompilerError);
    expect(caught?.line).toBe(1);
    expect(caught?.column).toBeGreaterThan(0);
    expect(caught?.snippet).toContain('> 1 |');
  });

  it('cleanMarkdownFences снимает ограждения ```tsx', () => {
    const fenced = '```tsx\nconst a: number = 1;\n```';
    expect(cleanMarkdownFences(fenced)).toBe('const a: number = 1;');
  });
});
