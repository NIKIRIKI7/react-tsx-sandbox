import React from 'react';
import * as Remotion from 'remotion';
import { Composition, registerRoot } from 'remotion';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';

// TSX, который пишет пользователь/ИИ. Компилируется и выполняется
// ровно тем же пайплайном песочницы, что и в продакшене.
const userCode = [
  "import React from 'react';",
  "import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';",
  '',
  'export default function Scene() {',
  '  const frame = useCurrentFrame();',
  '  const { fps } = useVideoConfig();',
  '  const enter = spring({ frame, fps, config: { damping: 20 } });',
  '  const x = interpolate(frame, [0, 60], [-320, 320]);',
  '  const opacity = interpolate(frame, [0, 20, 40, 60], [0, 1, 1, 0]);',
  '',
  '  return (',
  "    <AbsoluteFill style={{ backgroundColor: '#0b1326', justifyContent: 'center', alignItems: 'center' }}>",
  '      <div',
  '        style={{',
  '          transform: `translateX(${x}px) scale(${enter})`,',
  '          opacity,',
  "          color: '#4fdbc8',",
  "          fontFamily: 'Arial, sans-serif',",
  '          fontSize: 72,',
  '          fontWeight: 900,',
  '          letterSpacing: 4,',
  '        }}',
  '      >',
  '        QWEN 3.8',
  '      </div>',
  "      <div style={{ position: 'absolute', bottom: 40, color: '#ddb7ff', fontFamily: 'monospace', fontSize: 20 }}>",
  '        FRAME {frame} / 60',
  '      </div>',
  '    </AbsoluteFill>',
  '  );',
  '}',
].join('\n');

const compiled = compileTsx(userCode);

const Scene = executeComponent(
  compiled,
  { react: React, remotion: Remotion },
  { staticFile: (filename: string) => filename },
);

const Root: React.FC = () => {
  return (
    <Composition
      id="Sandbox"
      component={Scene}
      durationInFrames={60}
      fps={30}
      width={640}
      height={360}
    />
  );
};

registerRoot(Root);
