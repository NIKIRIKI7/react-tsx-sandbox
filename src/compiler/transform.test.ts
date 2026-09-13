import { describe, it, expect } from 'vitest';
import { compileTsx } from './transform';
import { CompilerError } from '../core/errors';

describe('compiler/transform.compileTsx', () => {
  it('strips TypeScript type annotations', () => {
    const output = compileTsx(`const value: number = 1; export default value;`);

    expect(output).not.toContain(': number');
    expect(output).toContain('const value = 1');
  });

  it('transforms JSX into React.createElement (classic runtime)', () => {
    const output = compileTsx(
      `import React from 'react'; export default function C() { return <div className="box">hi</div>; }`,
    );

    expect(output).not.toContain('<div');
    expect(output).toContain('.createElement');
  });

  it('converts ES module syntax into CommonJS require/exports', () => {
    const output = compileTsx(
      `import React from 'react'; import { motion } from 'framer-motion'; export const x = motion; export const y = React;`,
    );

    expect(output).toContain(`require('react')`);
    expect(output).toContain(`require('framer-motion')`);
    expect(output).toContain('exports.');
  });

  it('strips markdown fence markers before compiling', () => {
    const fenced = "```tsx\nconst a: number = 1;\nexport default a;\n```";
    const output = compileTsx(fenced);

    expect(output).not.toContain('```');
    expect(output).toContain('const a = 1');
  });

  it('keeps generic type parameters from breaking the output', () => {
    const output = compileTsx(
      `function identity<T>(value: T): T { return value; } export default identity<string>('ok');`,
    );

    expect(output).toContain('function identity(value)');
    expect(output).toContain('identity(');
  });

  it('wraps syntax errors into a CompilerError', () => {
    expect(() => compileTsx('const = ;')).toThrow(CompilerError);
    expect(() => compileTsx('const = ;')).toThrow(/\[Compiler Error\]/);
  });

  it('compiles a realistic Remotion-style component', () => {
    const code = `
      import React from 'react';
      import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';

      interface Props { title: string }

      export const Scene: React.FC<Props> = ({ title }) => {
        const frame = useCurrentFrame();
        return (
          <AbsoluteFill>
            <Sequence from={0} durationInFrames={60}>
              <h1>{title} @ {frame}</h1>
            </Sequence>
          </AbsoluteFill>
        );
      };

      export default Scene;
    `;

    const output = compileTsx(code);

    expect(output).toContain(`require('remotion')`);
    expect(output).toContain('exports.Scene');
    expect(output).toContain('.createElement');
  });
});
