// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PlayPauseButton,
  PlayPauseButtonRenderProps,
  TimeDisplay,
  TimelineBar,
  VolumeControl,
} from './Primitives';
import { PlayerContext, PlayerContextValue } from './PlayerContext';

function createContextValue(overrides: Partial<PlayerContextValue> = {}): PlayerContextValue {
  return {
    playerRef: { current: null },
    containerRef: { current: null },
    currentFrame: 45,
    durationInFrames: 300,
    fps: 30,
    isPlaying: false,
    isMuted: false,
    volume: 0.8,
    zoom: 1,
    pan: { x: 0, y: 0 },
    seekTo: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setZoom: vi.fn(),
    setPan: vi.fn(),
    resetZoomPan: vi.fn(),
    takeSnapshot: vi.fn(async () => 'data:'),
    ...overrides,
  };
}

function renderWithContext(
  ui: React.ReactElement,
  overrides: Partial<PlayerContextValue> = {},
) {
  const value = createContextValue(overrides);
  return { value, ...render(<PlayerContext.Provider value={value}>{ui}</PlayerContext.Provider>) };
}

describe('Player Shared Primitives', () => {
  it('PlayPauseButton рендерит дефолтный UI и переключает воспроизведение', () => {
    const toggle = vi.fn();
    renderWithContext(<PlayPauseButton />, { toggle });

    const button = screen.getByTestId('player-play-button') as HTMLButtonElement;
    expect(button.textContent).toBe('▶');

    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('PlayPauseButton в состоянии play показывает паузу', () => {
    renderWithContext(<PlayPauseButton />, { isPlaying: true });
    expect(screen.getByTestId('player-play-button').textContent).toBe('❚❚');
  });

  it('PlayPauseButton поддерживает render props', () => {
    renderWithContext(
      <PlayPauseButton>
        {({ isPlaying, toggle }) => (
          <button data-testid="custom-play" onClick={toggle}>
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
        )}
      </PlayPauseButton>,
      { isPlaying: true },
    );

    expect(screen.getByTestId('custom-play').textContent).toBe('PAUSE');
    expect(screen.queryByTestId('player-play-button')).toBeNull();
  });

  it('TimeDisplay форматирует время (time)', () => {
    renderWithContext(<TimeDisplay format="time" />);
    expect(screen.getByTestId('player-time-display').textContent).toBe('00:01 / 00:10');
  });

  it('TimeDisplay форматирует кадры (frames)', () => {
    renderWithContext(<TimeDisplay format="frames" />);
    expect(screen.getByTestId('player-time-display').textContent).toBe('45 / 300f');
  });

  it('TimeDisplay поддерживает render props', () => {
    renderWithContext(
      <TimeDisplay
        render={({ frame, totalFrames }) => (
          <span data-testid="custom-time">
            {frame}/{totalFrames}
          </span>
        )}
      />,
    );
    expect(screen.getByTestId('custom-time').textContent).toBe('45/300');
  });

  it('TimelineBar вызывает seekTo при перетаскивании дефолтного ползунка', () => {
    const seekTo = vi.fn();
    renderWithContext(<TimelineBar />, { seekTo });

    const range = screen.getByTestId('player-timeline').querySelector('input')!;
    fireEvent.change(range, { target: { value: '150' } });
    expect(seekTo).toHaveBeenCalledWith(150);
  });

  it('TimelineBar поддерживает render props', () => {
    const seekTo = vi.fn();
    renderWithContext(
      <TimelineBar
        render={({ currentFrame, seekTo: seek }) => (
          <input
            type="number"
            data-testid="custom-timeline"
            value={currentFrame}
            onChange={(event) => seek(Number(event.target.value))}
          />
        )}
      />,
      { seekTo },
    );

    fireEvent.change(screen.getByTestId('custom-timeline'), { target: { value: '12' } });
    expect(seekTo).toHaveBeenCalledWith(12);
  });

  it('VolumeControl рендерит дефолтный UI и меняет громкость', () => {
    const setVolume = vi.fn();
    const toggleMute = vi.fn();
    renderWithContext(<VolumeControl />, { setVolume, toggleMute });

    const slider = screen.getByTestId('player-volume-slider');
    fireEvent.change(slider, { target: { value: '0.25' } });
    expect(setVolume).toHaveBeenCalledWith(0.25);

    fireEvent.click(screen.getByTestId('player-mute-button'));
    expect(toggleMute).toHaveBeenCalledTimes(1);
  });

  it('VolumeControl показывает mute-иконку при нулевой громкости', () => {
    renderWithContext(<VolumeControl />, { volume: 0 });
    expect(screen.getByTestId('player-mute-button').textContent).toBe('🔇');
  });

  it('VolumeControl поддерживает render props', () => {
    renderWithContext(
      <VolumeControl
        render={({ volume, isMuted }) => (
          <span data-testid="custom-volume">{isMuted ? 'muted' : volume}</span>
        )}
      />,
      { volume: 0.5, isMuted: false },
    );
    expect(screen.getByTestId('custom-volume').textContent).toBe('0.5');
  });

  it('usePlayerContext бросает ошибку вне PlayerSandbox.Root', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      return <PlayPauseButton />;
    };
    expect(() => render(<Boom />)).toThrow(/PlayerSandbox\.Root/);
    spy.mockRestore();
  });

  it('PlayPauseButton принимает render prop с корректным типом контекста', () => {
    const toggle = vi.fn();
    const renderProp = (context: PlayPauseButtonRenderProps) => (
      <button data-testid="typed-play" onClick={context.toggle}>
        {context.isPlaying ? 'on' : 'off'}
      </button>
    );
    renderWithContext(<PlayPauseButton>{renderProp}</PlayPauseButton>, { toggle });

    fireEvent.click(screen.getByTestId('typed-play'));
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
