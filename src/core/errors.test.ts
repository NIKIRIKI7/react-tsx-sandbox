import { describe, it, expect } from 'vitest';
import { CompilerError, SecurityError, NetworkModuleError } from './errors';

describe('core/errors', () => {
  it('CompilerError prefixes the message and sets the name', () => {
    const error = new CompilerError('Unexpected token');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CompilerError');
    expect(error.message).toBe('[Compiler Error]: Unexpected token');
  });

  it('SecurityError prefixes the message and sets the name', () => {
    const error = new SecurityError('forbidden module');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SecurityError');
    expect(error.message).toBe('[Security Violation]: forbidden module');
  });

  it('NetworkModuleError includes the package name and the original message', () => {
    const error = new NetworkModuleError('framer-motion', '404 Not Found');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NetworkModuleError');
    expect(error.message).toContain('framer-motion');
    expect(error.message).toContain('404 Not Found');
  });

  it('keeps a usable stack trace', () => {
    const error = new CompilerError('boom');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('CompilerError');
  });
});
