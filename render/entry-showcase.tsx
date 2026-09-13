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
import { Activity, Cpu, Sparkles, Zap } from 'lucide-react';
import { SandboxFacade } from '../src/facade';
import { css } from './.generated/showcase-css';
import { source } from './.generated/showcase-scene';

// d3 и three не зарегистрированы — песочница скачает их с esm.sh в браузере.
const cdnImporter = (url: string) =>
  (new Function('u', 'return import(u)') as (u: string) => Promise<any>)(`${url}?bundle`);

const ShowcaseScene: React.FC = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [handle] = useState(() => delayRender('showcase: loading libraries'));

  useEffect(() => {
    const facade = new SandboxFacade(
      {
        react: React,
        remotion: Remotion,
        'lucide-react': { Cpu, Zap, Sparkles, Activity },
      },
      { importer: cdnImporter },
    );

    facade
      .compile(source)
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
    return <AbsoluteFill style={{ backgroundColor: '#020617' }} />;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Component />
    </>
  );
};

const Root: React.FC = () => {
  return (
    <Composition
      id="Showcase"
      component={ShowcaseScene}
      durationInFrames={120}
      fps={30}
      width={1280}
      height={720}
    />
  );
};

registerRoot(Root);
