// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlayerSandbox } from './PlayerSandbox';
import type { PlayerSandboxRef } from './PlayerSandbox';

beforeAll(() => {
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof (globalThis as { matchMedia?: unknown }).matchMedia === 'undefined') {
    (globalThis as { matchMedia?: unknown }).matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    });
  }
});

describe('PlayerSandbox: reliability, DX и headless UI', () => {
  it('предоставляет императивный ref API (seekTo/getCurrentFrame/snapshot)', async () => {
    const ref = React.createRef<PlayerSandboxRef>();

    render(
      <PlayerSandbox
        ref={ref}
        config={{
          code: `export default function C(){ return <div>Playback Scene</div>; }`,
          durationInFrames: 120,
          fps: 30,
          controls: false,
        }}
      />,
    );

    expect(await screen.findByText('Playback Scene')).toBeTruthy();
    expect(ref.current).toBeTruthy();

    act(() => {
      ref.current?.seekTo(45);
    });

    await waitFor(() => expect(ref.current?.getCurrentFrame()).toBe(45));
    expect(typeof ref.current?.takeSnapshot).toBe('function');
    expect(typeof ref.current?.exportVideo).toBe('function');
    expect(typeof ref.current?.abortExport).toBe('function');
    expect(Array.isArray(ref.current?.getActiveDelayHandles())).toBe(true);
  });

  it('сохраняет текущий кадр при перекомпиляции (Smart Frame Retention)', async () => {
    const ref = React.createRef<PlayerSandboxRef>();

    const { rerender } = render(
      <PlayerSandbox
        ref={ref}
        config={{
          code: `export default function C(){ return <div>Frame 1</div>; }`,
          durationInFrames: 100,
          controls: false,
          smartFrameRetention: true,
        }}
      />,
    );

    await screen.findByText('Frame 1');
    act(() => ref.current?.seekTo(72));
    await waitFor(() => expect(ref.current?.getCurrentFrame()).toBe(72));

    rerender(
      <PlayerSandbox
        ref={ref}
        config={{
          code: `export default function C(){ return <div>Frame 2 Updated</div>; }`,
          durationInFrames: 100,
          controls: false,
          smartFrameRetention: true,
        }}
      />,
    );

    await screen.findByText('Frame 2 Updated');
    await waitFor(() => expect(ref.current?.getCurrentFrame()).toBe(72));
  });

  it('показывает Safe Zones Overlay', async () => {
    render(
      <PlayerSandbox
        config={{
          code: `export default function C(){ return <div>Shorts Scene</div>; }`,
          safeZone: ['tiktok-9x16', 'rule-of-thirds'],
          width: 1080,
          height: 1920,
          controls: false,
        }}
      />,
    );

    await screen.findByText('Shorts Scene');
    expect(screen.getByTestId('safe-zones-overlay')).toBeTruthy();
  });

  it('масштабирует холст по Ctrl+Wheel', async () => {
    render(
      <PlayerSandbox
        config={{
          code: `export default function C(){ return <div>Zoom Scene</div>; }`,
          durationInFrames: 60,
          controls: false,
          canvasControls: { enabled: true, minZoom: 0.25, maxZoom: 4 },
        }}
      />,
    );

    await screen.findByText('Zoom Scene');
    const container = screen.getByTestId('player-container');

    fireEvent.wheel(container, { ctrlKey: true, deltaY: -100 });

    await waitFor(() => expect(container.style.transform).toContain('scale(1.1)'));
  });

  it('рендерит headless compound components (PlayButton/TimeDisplay/Timeline)', async () => {
    render(
      <PlayerSandbox.Root
        config={{
          code: `export default function C(){ return <div>Custom UI Scene</div>; }`,
          durationInFrames: 150,
          fps: 30,
          controls: false,
        }}
      >
        <div data-testid="custom-studio-chrome">
          <PlayerSandbox.PlayButton />
          <PlayerSandbox.TimeDisplay format="frames" />
          <PlayerSandbox.Timeline />
        </div>
      </PlayerSandbox.Root>,
    );

    await screen.findByText('Custom UI Scene');

    expect(screen.getByTestId('custom-studio-chrome')).toBeTruthy();
    expect(screen.getByTestId('player-play-button')).toBeTruthy();
    expect(screen.getByTestId('player-time-display').textContent).toContain('0 / 150f');
    expect(screen.getByTestId('player-timeline')).toBeTruthy();
  });

  it('поддерживает render props для кастомного UI (без дефолтной разметки)', async () => {
    render(
      <PlayerSandbox.Root
        config={{
          code: `export default function C(){ return <div>Render Props Scene</div>; }`,
          durationInFrames: 200,
          fps: 25,
          controls: false,
        }}
      >
        <PlayerSandbox.PlayButton>
          {({ isPlaying }) => (
            <button data-testid="rp-play">{isPlaying ? 'pause' : 'play'}</button>
          )}
        </PlayerSandbox.PlayButton>
        <PlayerSandbox.TimeDisplay
          render={({ frame, totalFrames, fps }) => (
            <span data-testid="rp-time">
              {frame}/{totalFrames}@{fps}
            </span>
          )}
        />
        <PlayerSandbox.Timeline
          render={({ currentFrame, durationInFrames, seekTo }) => (
            <button data-testid="rp-timeline" onClick={() => seekTo(durationInFrames - 1)}>
              {currentFrame}
            </button>
          )}
        />
        <PlayerSandbox.VolumeControl
          render={({ volume, isMuted }) => (
            <span data-testid="rp-volume">{isMuted ? 'muted' : volume}</span>
          )}
        />
      </PlayerSandbox.Root>,
    );

    await screen.findByText('Render Props Scene');

    // Дефолтной разметки быть не должно — только кастомная.
    expect(screen.queryByTestId('player-play-button')).toBeNull();
    expect(screen.getByTestId('rp-play').textContent).toBe('play');
    expect(screen.getByTestId('rp-time').textContent).toBe('0/200@25');
    expect(screen.getByTestId('rp-timeline').textContent).toBe('0');
    expect(screen.getByTestId('rp-volume').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('rp-timeline'));
    await screen.findByText('Render Props Scene');
  });
});
