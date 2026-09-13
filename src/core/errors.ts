export class CompilerError extends Error {
  constructor(message: string) {
    super(`[Compiler Error]: ${message}`);
    this.name = 'CompilerError';
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(`[Security Violation]: ${message}`);
    this.name = 'SecurityError';
  }
}

export class NetworkModuleError extends Error {
  constructor(moduleName: string, originalMessage: string) {
    super(`[Network Error]: Не удалось загрузить пакет "${moduleName}". ${originalMessage}`);
    this.name = 'NetworkModuleError';
  }
}
