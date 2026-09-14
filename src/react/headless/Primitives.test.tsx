// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ExportButton,
  PlayPauseButton,
  PlayPauseButtonRenderProps,
  TimeDisplay,
  TimelineBar,
  VolumeControl,
} from './Primitives';
import { PlayerContext, PlayerContextValue } from './PlayerContext';
import type { ExportState } from './PlayerContext';

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
    exportState: { isExporting: false, progress: null, phase: null, error: null },
    exportVideo: vi.fn(async () => null),
    abortExport: vi.fn(),
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

  function withWebCodecs(enabled: boolean) {
    const globalObject = globalThis as { VideoEncoder?: unknown };
    if (enabled) {
      globalObject.VideoEncoder = class VideoEncoder {
        static isConfigSupported = vi.fn();
      };
    } else {
      delete globalObject.VideoEncoder;
    }
  }

  it('ExportButton вызывает exportVideo из контекста с настройками', () => {
    withWebCodecs(true);
    try {
      const exportVideo = vi.fn(async () => null);
      renderWithContext(
        <ExportButton filename="clip.mp4" codec="avc" quality="high" bitrate={2_500_000} />,
        { exportVideo },
      );

      fireEvent.click(screen.getByTestId('player-export-button'));
      expect(exportVideo).toHaveBeenCalledWith({
        filename: 'clip.mp4',
        codec: 'avc',
        quality: 'high',
        bitrate: 2_500_000,
      });
    } finally {
      withWebCodecs(false);
    }
  });

  it('ExportButton показывает прогресс экспорта из exportState', () => {
    withWebCodecs(true);
    try {
      const exportState: ExportState = {
        isExporting: true,
        progress: 0.5,
        phase: 'encoding',
        error: null,
      };
      renderWithContext(<ExportButton />, { exportState });
      expect(screen.getByTestId('player-export-button').textContent).toBe('50%');
    } finally {
      withWebCodecs(false);
    }
  });

  it('ExportButton дизаблится без поддержки WebCodecs', () => {
    withWebCodecs(false);
    try {
      const exportVideo = vi.fn(async () => null);
      renderWithContext(<ExportButton filename="a.mp4" />, { exportVideo });

      const button = screen.getByTestId('player-export-button') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      expect(exportVideo).not.toHaveBeenCalled();
    } finally {
      withWebCodecs(false);
    }
  });

  it('ExportButton передаёт error и cancel в render prop', () => {
    withWebCodecs(true);
    try {
      const abortExport = vi.fn();
      const exportState: ExportState = {
        isExporting: false,
        progress: null,
        phase: null,
        error: new Error('boom'),
      };
      renderWithContext(
        <ExportButton>
          {({ error, cancel, exportVideo }) => (
            <button
              data-testid="custom-export"
              data-error={error ?? ''}
              onClick={() => {
                cancel();
                exportVideo();
              }}
            />
          )}
        </ExportButton>,
        { exportState, abortExport },
      );

      const custom = screen.getByTestId('custom-export') as HTMLButtonElement;
      expect(custom.dataset.error).toBe('boom');
      fireEvent.click(custom);
      expect(abortExport).toHaveBeenCalledTimes(1);
    } finally {
      withWebCodecs(false);
    }
  });
});
