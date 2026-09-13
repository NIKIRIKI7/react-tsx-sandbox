import React from 'react';
import * as Remotion from 'remotion';
import { Composition, registerRoot } from 'remotion';
import { AudioLines, Mic, Music } from 'lucide-react';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';
import * as Timeline from '../src/timeline';
import { css, source } from './.generated/voiceover-scene';

// Сцена с реальной озвучкой из examples/voice/, скомпилированная песочницей.
// Модуль `browser-tsx-sandbox` (Timeline API) подставляется напрямую, без CDN.
const Scene = executeComponent(
  compileTsx(source),
  {
    react: React,
    remotion: Remotion,
    'lucide-react': { AudioLines, Mic, Music },
    'browser-tsx-sandbox': Timeline,
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
      id="VoiceoverAnimation"
      component={StyledScene}
      durationInFrames={300}
      fps={30}
      width={1280}
      height={720}
    />
  );
};

registerRoot(Root);
