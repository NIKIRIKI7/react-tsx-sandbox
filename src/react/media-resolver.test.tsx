// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { applyMediaResolver } from './media-resolver';

const FakeRemotion = {
  Video: React.forwardRef<any, HTMLVideoElement>((props, ref) => (
    <video data-testid="video" src={props.src} ref={ref} />
  )),
  OffthreadVideo: (props: any) => <div data-testid="offthread" data-src={props.src} />,
  delayRender: (label?: string) => 1,
};

const viteResolver = (src: string) => {
  const clean = src.replace(/^file:\/\/\//i, '').replace(/\\/g, '/');
  if (/^[a-zA-Z]:[\\/]/.test(clean)) return '/@fs/' + clean;
  return src;
};

const asAny = (record: Record<string, unknown>) => record as any;

describe('applyMediaResolver', () => {
  it('применяет resolver к src OffthreadVideo/Video/Audio/Img', () => {
    const patched = applyMediaResolver(asAny(FakeRemotion), viteResolver);
    const Video = patched.Video as any;

    const App = () => <Video src={'C:\\Users\\mcniki\\Videos\\clip.mp4'} />;

    render(<App />);
    expect(screen.getByTestId('video').getAttribute('src')).toBe('/@fs/C:/Users/mcniki/Videos/clip.mp4');
  });

  it('не трогает остальные экспорты модуля', () => {
    const patched = applyMediaResolver(asAny(FakeRemotion), viteResolver);
    expect((patched.delayRender as any)('x')).toBe(1);
  });

  it('пропускает не строковые src и пустые компоненты', () => {
    const rem = { ...FakeRemotion, Img: null };
    const patched = applyMediaResolver(asAny(rem), viteResolver);
    expect(patched.Img).toBeNull();
  });

  it('сохраняет forwardRef-реф', () => {
    const patched = applyMediaResolver(asAny(FakeRemotion), viteResolver);
    const Video = patched.Video as any;
    const ref = React.createRef<any>();

    const App = () => <Video ref={ref} src="C:\\a\\b.mp4" />;

    render(<App />);
    expect(ref.current).toBeTruthy();
  });

  it('получает displayName вида MediaResolved(...)', () => {
    const patched = applyMediaResolver(asAny(FakeRemotion), viteResolver);
    expect((patched.Video as { displayName?: string }).displayName).toMatch(/^MediaResolved\(/);
  });
});