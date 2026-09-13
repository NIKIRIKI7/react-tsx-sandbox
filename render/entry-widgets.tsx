import React from 'react';
import * as Remotion from 'remotion';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';
import { css } from './.generated/widgets-css';
import { catalog } from './.generated/widgets-catalog';

interface VidoraWidget {
  id: string;
  name: string;
  default_props: Record<string, unknown>;
  tsx_code: string;
}

// Каждый виджет из JSON-каталога компилируется и выполняется песочницей.
const compositions = (catalog.widgets as VidoraWidget[]).map((widget) => {
  const Component = executeComponent(
    compileTsx(widget.tsx_code),
    { react: React, remotion: Remotion },
    { staticFile: (filename: string) => filename },
  );

  if (typeof Component !== 'function') {
    throw new Error(`Widget "${widget.id}" does not export a React component.`);
  }

  const Wrapped: React.FC = () => (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Component {...widget.default_props} />
      </AbsoluteFill>
    </>
  );

  return { widget, Component: Wrapped };
});

const Root: React.FC = () => {
  return (
    <>
      {compositions.map(({ widget, Component }) => {
        const vertical = widget.id.includes('9x16');
        return (
          <Composition
            key={widget.id}
            id={widget.id}
            component={Component}
            durationInFrames={300}
            fps={30}
            width={vertical ? 1080 : 1920}
            height={vertical ? 1920 : 1080}
          />
        );
      })}
    </>
  );
};

registerRoot(Root);
