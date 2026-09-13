/**
 * Строки `.d.ts` для автодополнения глобалов песочницы в Monaco/CodeMirror.
 *
 * ```ts
 * const defs = getSandboxTypeDefinitions();
 * defs.forEach(({ filename, content }) =>
 *   monaco.languages.typescript.typescriptDefaults.addExtraLib(content, filename),
 * );
 * ```
 */
export function getSandboxTypeDefinitions(): { filename: string; content: string }[] {
  return [
    {
      filename: 'ts:browser-tsx-sandbox/globals.d.ts',
      content: `
        declare function staticFile(filename: string): string;
        declare const React: typeof import('react');
      `,
    },
    {
      filename: 'ts:browser-tsx-sandbox/remotion.d.ts',
      content: `
        declare module 'remotion' {
          export function useCurrentFrame(): number;
          export function useVideoConfig(): {
            fps: number;
            durationInFrames: number;
            width: number;
            height: number;
            id: string;
          };
          export function spring(options: any): number;
          export function interpolate(
            input: number,
            inputRange: number[],
            outputRange: number[],
            options?: any,
          ): number;
          export const AbsoluteFill: React.FC<React.HTMLAttributes<HTMLDivElement>>;
          export const Sequence: React.FC<any>;
          export const Composition: React.FC<any>;
          export const OffthreadVideo: React.FC<any>;
          export const Img: React.FC<any>;
          export const Easing: any;
          export const staticFile: (name: string) => string;
        }
      `,
    },
  ];
}
