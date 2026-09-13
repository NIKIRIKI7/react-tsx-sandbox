export type ModuleRegistry = Record<string, any>;

export interface SandboxGlobals {
  staticFile: (filename: string) => string;
  [key: string]: any;
}

export interface EvaluationResult<T = any> {
  component: T | null;
  error: Error | null;
  executionTimeMs: number;
}
