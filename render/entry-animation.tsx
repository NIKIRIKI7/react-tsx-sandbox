import React from 'react';
import * as Remotion from 'remotion';
import { Composition, registerRoot } from 'remotion';
import { AudioLines, Music, Sparkles, Zap } from 'lucide-react';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';
import { css, source } from './.generated/animation-scene';

// Реальная анимация со звуком из examples/, скомпилированная песочницей.
// `<Audio>` читает `audio/music.mp3` и `audio/pop.ogg` из render/public через `staticFile`.
const Scene = executeComponent(
  compileTsx(source),
  {
    react: React,
    remotion: Remotion,
    'lucide-react': { AudioLines, Music, Sparkles, Zap },
  },
  { staticFile: (filename: string) => Remotion.staticFile(filename) },
);

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
      id="AudioAnimation"
      component={StyledScene}
      durationInFrames={210}
      fps={30}
      width={1280}
      height={720}
    />
  );
};

registerRoot(Root);
