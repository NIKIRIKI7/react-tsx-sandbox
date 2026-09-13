import React from 'react';
import * as Remotion from 'remotion';
import { AbsoluteFill, Composition, Img, registerRoot } from 'remotion';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';
import { css } from './.generated/props-css';
import { variants } from './.generated/props-variants';

// Заглушка lucide-react: любой запрошенный iconName превращается в компонент.
const IconStub: React.FC<Record<string, unknown>> = (props) => <div data-icon {...props} />;
const LucideStub = new Proxy(
  { __esModule: true },
  {
    get: (target: Record<string, unknown>, name: string) =>
      name in target ? target[name] : IconStub,
  },
);

// `asset:<path>` в пропсах резолвится в раздаваемый URL (аналог blob: из AssetStore).
function resolveProps(props: Record<string, unknown>) {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    resolved[key] =
      typeof value === 'string' && value.startsWith('asset:')
        ? Remotion.staticFile(value.slice('asset:'.length))
        : value;
  }
  return resolved;
}

const compositions = (variants as Array<{ id: string; code: string; props: Record<string, unknown> }>).map(
  (variant) => {
    const Component = executeComponent(
      compileTsx(variant.code),
      { react: React, remotion: Remotion, 'lucide-react': LucideStub },
      { staticFile: (filename: string) => filename },
    );
    const props = resolveProps(variant.props);
    const imageUrl = typeof props.imageUrl === 'string' ? props.imageUrl : '';

    const Wrapped: React.FC = () => (
      <>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          {/* Скрытый Remotion <Img> прогревает картинку, чтобы <img> виджета успел отрисоваться. */}
          {imageUrl ? (
            <Img src={imageUrl} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
          ) : null}
          <Component {...props} />
        </AbsoluteFill>
      </>
    );

    return { variant, Component: Wrapped };
  },
);

const Root: React.FC = () => {
  return (
    <>
      {compositions.map(({ variant, Component }) => (
        <Composition
          key={variant.id}
          id={variant.id}
          component={Component}
          durationInFrames={300}
          fps={30}
          width={1920}
          height={1080}
        />
      ))}
    </>
  );
};

registerRoot(Root);
