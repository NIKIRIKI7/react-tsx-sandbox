import { transform } from 'sucrase';
import { CompilerError } from '../core/errors';

/**
 * Транспилирует TSX в CommonJS (React.createElement).
 */
export function compileTsx(code: string): string {
  try {
    const cleanCode = code.replace(/```tsx\n?/g, '').replace(/```\n?/g, '');

    const compiled = transform(cleanCode, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'classic',
    });

    return compiled.code;
  } catch (error) {
    throw new CompilerError((error as Error).message);
  }
}
