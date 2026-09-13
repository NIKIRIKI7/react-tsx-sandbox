import React from 'react';
import * as Remotion from 'remotion';
import { Composition, registerRoot } from 'remotion';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';

// Сцена, которая использует ассеты, распакованные из ZIP и разложенные
// в public-каталог Remotion. Ссылки резолвятся через `staticFile`.
const userCode = [
  "import React from 'react';",
  "import { AbsoluteFill, OffthreadVideo, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';",
  '',
  'export default function Scene() {',
  '  const frame = useCurrentFrame();',
  '  const { durationInFrames } = useVideoConfig();',
  '  const badgeOpacity = interpolate(frame, [0, durationInFrames / 2], [0, 1]);',
  '',
  '  return (',
  "    <AbsoluteFill style={{ backgroundColor: '#000000' }}>",
  '      <OffthreadVideo',
  "        src={staticFile('assets/clip.mp4')}",
  "        style={{ width: '100%', height: '100%', objectFit: 'cover' }}",
  '      />',
  '      <Img',
  "        src={staticFile('assets/logo.svg')}",
  "        style={{ position: 'absolute', top: 24, left: 24, width: 140, opacity: badgeOpacity }}",
  '      />',
  "      <div style={{ position: 'absolute', bottom: 24, right: 24, color: '#4fdbc8', fontFamily: 'monospace', fontSize: 18 }}>",
  '        ASSET ZIP // FRAME {frame}',
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
      id="SandboxAssets"
      component={Scene}
      durationInFrames={60}
      fps={30}
      width={640}
      height={360}
    />
  );
};

registerRoot(Root);
