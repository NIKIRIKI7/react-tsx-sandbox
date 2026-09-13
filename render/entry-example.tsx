import React from 'react';
import * as Remotion from 'remotion';
import { Composition, registerRoot } from 'remotion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Layers,
  Lock,
  Radio,
  Server,
  Shield,
  Sliders,
  Sparkles,
  Terminal,
  TrendingUp,
  Unlock,
  Zap,
} from 'lucide-react';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';
import { css, source } from './.generated/example-scene';

// Реальный TSX из examples/, скомпилированный и выполненный песочницей.
const Scene = executeComponent(
  compileTsx(source),
  {
    react: React,
    remotion: Remotion,
    'lucide-react': {
      Activity,
      AlertTriangle,
      ArrowRight,
      CheckCircle2,
      Cpu,
      Database,
      Globe,
      HardDrive,
      Layers,
      Lock,
      Radio,
      Server,
      Shield,
      Sliders,
      Sparkles,
      Terminal,
      TrendingUp,
      Unlock,
      Zap,
    },
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
      id="ExampleScene"
      component={StyledScene}
      durationInFrames={1177}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

registerRoot(Root);
