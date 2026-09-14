import * as React from 'react';

const MEDIA_COMPONENTS = ['OffthreadVideo', 'Video', 'Audio', 'Img'] as const;

/**
 * Прозрачно оборачивает медиа-компоненты Remotion (`OffthreadVideo`, `Video`,
 * `Audio`, `Img`), применяя `resolver` к пропу `src` перед рендером.
 * Код сцены при этом не меняется — локальные пути (например `C:\...`)
 * преобразуются в веб-доступные URL (blob:, /@fs/, data: и т.д.).
 */
export function applyMediaResolver(
  remotionModule: Record<string, unknown>,
  resolver: (src: string) => string,
): Record<string, unknown> {
  const patched: Record<string, unknown> = { ...remotionModule };

  for (const name of MEDIA_COMPONENTS) {
    const Comp = patched[name];
    if (!Comp) continue;

    const Wrapped = React.forwardRef((props: any, ref: any) => {
      const src = typeof props.src === 'string' ? resolver(props.src) : props.src;
      return React.createElement(Comp as React.ElementType, { ...props, ref, src });
    });
    Wrapped.displayName = `MediaResolved(${getName(Comp, name)})`;
    patched[name] = Wrapped;
  }

  return patched;
}

function getName(Comp: unknown, fallback: string): string {
  if (typeof Comp === 'function') return Comp.name || fallback;
  if (Comp && typeof Comp === 'object') {
    const displayName = (Comp as { displayName?: string }).displayName;
    if (displayName) return displayName;
    const renderFn = (Comp as { render?: { name?: string } }).render;
    if (renderFn && renderFn.name) return renderFn.name;
  }
  return fallback;
}