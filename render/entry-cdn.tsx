import React, { useEffect, useState } from 'react';
import * as Remotion from 'remotion';
import {
  AbsoluteFill,
  Composition,
  cancelRender,
  continueRender,
  delayRender,
  registerRoot,
} from 'remotion';
import { SandboxFacade } from '../src/facade';

// Пользовательский TSX импортирует сторонние библиотеки по bare-именам.
// Их нет в registry, поэтому SandboxFacade скачает их с esm.sh в браузере.
const userCode = [
  "import React from 'react';",
  "import { AbsoluteFill, useCurrentFrame } from 'remotion';",
  "import { range, max, mean } from 'd3';",
  "import * as THREE from 'three';",
  '',
  'export default function Scene() {',
  '  const frame = useCurrentFrame();',
  '  const values = range(0, 1.001, 0.05).map((t) => Math.sin(t * Math.PI * 2 + frame / 12));',
  '  const peak = max(values) ?? 0;',
  '  const avg = mean(values) ?? 0;',
  '  const len = new THREE.Vector3(3, 4, frame % 5).length();',
  '',
  '  return (',
  "    <AbsoluteFill style={{ backgroundColor: '#0b1326', justifyContent: 'center', alignItems: 'center', fontFamily: 'monospace', color: '#4fdbc8', gap: 12 }}>",
  "      <div style={{ fontSize: 28, fontWeight: 700 }}>CDN LIBS // LIVE FROM ESM.SH</div>",
  '      <div style={{ fontSize: 20 }}>d3 max = {peak.toFixed(4)} | mean = {avg.toFixed(4)}</div>',
  '      <div style={{ fontSize: 20 }}>three Vector3 length = {len.toFixed(4)}</div>',
  '    </AbsoluteFill>',
  '  );',
  '}',
].join('\n');

// `new Function` экранирует webpack, чтобы выполнился нативный import() браузера.
const cdnImporter = (url: string) =>
  (new Function('u', 'return import(u)') as (u: string) => Promise<any>)(`${url}?bundle`);

const CdnScene: React.FC = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [handle] = useState(() => delayRender('loading libraries from esm.sh'));

  useEffect(() => {
    const facade = new SandboxFacade({ react: React, remotion: Remotion }, cdnImporter);

    facade
      .compile(userCode)
      .then((result) => {
        if (result.error) {
          cancelRender(result.error);
          return;
        }
        setComponent(() => result.component);
        continueRender(handle);
      })
      .catch((error) => cancelRender(error));
  }, [handle]);

  if (!Component) {
    return <AbsoluteFill style={{ backgroundColor: '#0b1326' }} />;
  }

  return (
    <AbsoluteFill>
      <Component />
    </AbsoluteFill>
  );
};

const Root: React.FC = () => {
  return (
    <Composition
      id="CdnLibs"
      component={CdnScene}
      durationInFrames={60}
      fps={30}
      width={640}
      height={360}
    />
  );
};

registerRoot(Root);
