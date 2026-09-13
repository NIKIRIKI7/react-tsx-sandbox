import React from 'react';
import * as Remotion from 'remotion';
import { Composition, registerRoot } from 'remotion';
import { Mic, Music, Volume2 } from 'lucide-react';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';
import { css, source } from './.generated/audio-scene';

// Реальная аудиосцена из examples/, скомпилированная и выполненная песочницей.
// `<Audio>` читает WAV-файлы из render/public/audio через `staticFile`.
const Scene = executeComponent(
  compileTsx(source),
  {
    react: React,
    remotion: Remotion,
    'lucide-react': { Mic, Music, Volume2 },
  },
  { staticFile: (filename: string) => Remotion.staticFile(filename) },
);

// Tailwind-утилиты, скомпилированные на этапе сборки из исходника сцены.
const StyledScene: React.FC = () => {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Scene />
    </>
  );
};

const Root: React.FC = () => {
  return (
    <Composition
      id="AudioDucking"
      component={StyledScene}
      durationInFrames={300}
      fps={30}
      width={1280}
      height={720}
    />
  );
};

registerRoot(Root);
