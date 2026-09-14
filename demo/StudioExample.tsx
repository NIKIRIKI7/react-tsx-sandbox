import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as Remotion from 'remotion';
import { Camera, Download, Pause, Play, Sparkles, Volume2, VolumeX } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { PlayerSandbox } from '../src/player';
import type { PlayerSandboxRef } from '../src/player';
import { createTailwindJitPlugin } from '../src/plugins/tailwind-plugin';
import type { BrowserExportCodec, ExportQuality } from '../src/export/browser-export';
import { configureLogger } from '../src/core/logger';
import './styles.css';

const STUDIO_CODE = [
  "import React from 'react';",
  "import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';",
  "import { Zap } from 'lucide-react';",
  '',
  'export default function Reel() {',
  '  const frame = useCurrentFrame();',
  '  const { fps } = useVideoConfig();',
  '  const enter = spring({ frame, fps, config: { damping: 14 } });',
  "  const x = interpolate(frame, [0, 120], [-260, 0], { extrapolateRight: 'clamp' });",
  '',
  '  return (',
  "    <AbsoluteFill style={{ backgroundColor: '#131926', justifyContent: 'center', alignItems: 'center', color: '#4fdbc8', fontFamily: 'Arial, sans-serif' }}>",
  "      <div style={{ transform: `translateX(${x}px) scale(${enter})`, fontSize: 64, fontWeight: 900 }}>",
  '        FRAME {frame}',
  '      </div>',
  "      <Zap size={44} color='#ddb7ff' fill='#ddb7ff' style={{ position: 'absolute', top: 48 }} />",
  "      <div style={{ position: 'absolute', bottom: 80, color: '#ddb7ff', fontFamily: 'monospace' }}>",
  '        TikTok safe zone overlay',
  '      </div>',
  '    </AbsoluteFill>',
  '  );',
  '}',
].join('\n');

/** Ограничивает 9:16-плеер по высоте, чтобы он не растягивал страницу. */
function PlayerViewport({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-black/60 px-4 py-6 ring-1 ring-inset ring-slate-800">
      <div className="aspect-[9/16] h-[64vh] min-h-[320px] max-h-[720px]">{children}</div>
    </div>
  );
}

const CODE_LABELS: Record<BrowserExportCodec, string> = {
  avc: 'MP4 (H.264)',
  vp9: 'WebM (VP9)',
  vp8: 'WebM (VP8)',
};

export function StudioExample() {
  const playerRef = useRef<PlayerSandboxRef>(null);
  const [snapshot, setSnapshot] = useState('');
  const [status, setStatus] = useState('ready');
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [codec, setCodec] = useState<BrowserExportCodec>('avc');

  const toViteFsPath = (src: string): string => {
    const clean = src.replace(/^file:\/\/\//i, '');
    if (/^[a-zA-Z]:[\\/]/.test(clean)) {
      return '/@fs/' + clean.replace(/\\/g, '/');
    }
    return src;
  };

  const plugins = useMemo(() => [createTailwindJitPlugin()], []);

  const modules = useMemo(() => ({ remotion: Remotion, 'lucide-react': Lucide }), []);

  useEffect(() => {
    configureLogger({ enabled: true });
  }, []);

  const capture = async () => {
    try {
      const url = await playerRef.current?.takeSnapshot({ format: 'image/png' });
      if (url) setSnapshot(url);
      setStatus('snapshot taken');
    } catch (error) {
      setStatus(`snapshot failed: ${(error as Error).message}`);
    }
  };

  const programmaticExport = async () => {
    try {
      setStatus('exporting…');
      const blob = await playerRef.current?.exportVideo({
        filename: `studio-export.${codec === 'avc' ? 'mp4' : 'webm'}`,
        codec,
        quality,
        onProgress: (next) => setStatus(`${Math.round(next.progress * 100)}% ${next.phase}`),
      });
      if (blob) {
        setStatus(`done: ${(blob.size / 1024).toFixed(0)} KB, ${blob.type}`);
      } else {
        setStatus('export returned nothing');
      }
    } catch (error) {
      setStatus(`export failed: ${(error as Error).message}`);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">browser-tsx-sandbox · Studio</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Smart Frame Retention, скриншот кадра, safe zones, зум, headless-контролы и{' '}
            <strong>браузерный экспорт MP4/WebM</strong>.
          </p>
        </div>
        <a href="/" className="text-sm text-emerald-400 transition hover:text-emerald-300">
          ← Player demo
        </a>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <PlayerSandbox.Root
            ref={playerRef}
            config={{
              code: STUDIO_CODE,
              modules: modules,
              plugins,
              mediaResolver: toViteFsPath,
              durationInFrames: 150,
              fps: 30,
              width: 1080,
              height: 1920,
              controls: false,
              loop: true,
              smartFrameRetention: true,
              delayRenderTimeoutMs: 3500,
              safeZone: ['tiktok-9x16', 'rule-of-thirds'],
              canvasControls: { enabled: true, minZoom: 0.5, maxZoom: 3, initialZoom: 1 },
              wrapper: PlayerViewport,
              renderLoading: () => <div className="p-6 text-sm text-slate-400">Compiling…</div>,
            }}
          >
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <PlayerSandbox.PlayButton>
                {({ isPlaying, toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="grid h-11 w-11 place-items-center rounded-full bg-emerald-400 text-emerald-950 transition hover:bg-emerald-300 active:scale-95"
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                )}
              </PlayerSandbox.PlayButton>

              <PlayerSandbox.TimeDisplay
                render={({ time, totalTime }) => (
                  <span className="font-mono text-sm tabular-nums text-slate-300">
                    {time}
                    <span className="px-1 text-slate-600">/</span>
                    {totalTime}
                  </span>
                )}
              />

              <PlayerSandbox.Timeline
                render={({ currentFrame, durationInFrames, seekTo }) => (
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, durationInFrames - 1)}
                    value={currentFrame}
                    onChange={(event) => seekTo(Number(event.target.value))}
                    aria-label="Timeline"
                    className="h-2 min-w-[160px] flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-emerald-400"
                  />
                )}
              />

              <PlayerSandbox.VolumeControl
                render={({ volume, isMuted, toggleMute }) => (
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-slate-700 text-slate-300 transition hover:bg-slate-800"
                  >
                    {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                )}
              />

              <label className="text-xs text-slate-400">
                quality
                <select
                  value={quality}
                  onChange={(event) => setQuality(event.target.value as ExportQuality)}
                  className="ml-2 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>

              <label className="text-xs text-slate-400">
                codec
                <select
                  value={codec}
                  onChange={(event) => setCodec(event.target.value as BrowserExportCodec)}
                  className="ml-2 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="avc">{CODE_LABELS.avc}</option>
                  <option value="vp9">{CODE_LABELS.vp9}</option>
                  <option value="vp8">{CODE_LABELS.vp8}</option>
                </select>
              </label>

              <PlayerSandbox.ExportButton
                filename={`studio-export.${codec === 'avc' ? 'mp4' : 'webm'}`}
                codec={codec}
                quality={quality}
              >
                {({ isExporting, progress, exportVideo }) => (
                  <button
                    type="button"
                    onClick={exportVideo}
                    disabled={isExporting}
                    aria-label="Export video"
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-400 transition hover:bg-emerald-900/50 disabled:opacity-50"
                  >
                    <Download size={16} />
                    {isExporting
                      ? `Экспорт ${Math.round((progress ?? 0) * 100)}%`
                      : `UI Экспорт (${quality})`}
                  </button>
                )}
              </PlayerSandbox.ExportButton>

              <button
                type="button"
                onClick={programmaticExport}
                className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-700/50 bg-fuchsia-900/30 px-3 py-2 text-sm text-fuchsia-300 transition hover:bg-fuchsia-900/50"
              >
                <Sparkles size={16} />
                Export (programmatic)
              </button>

              <button
                type="button"
                onClick={capture}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700"
              >
                <Camera size={16} />
                Кадр
              </button>
            </div>
          </PlayerSandbox.Root>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Poster snapshot
            </h3>
            <span className="font-mono text-xs text-slate-500">{status}</span>
          </div>

          {snapshot ? (
            snapshot.startsWith('data:image/svg+xml') ? (
              <div
                data-testid="snapshot-svg"
                className="mt-3 max-h-[440px] overflow-hidden rounded-xl border border-slate-800 [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{
                  __html: decodeURIComponent(snapshot.slice(snapshot.indexOf(',') + 1)),
                }}
              />
            ) : (
              <img
                src={snapshot}
                alt="Snapshot"
                className="mt-3 w-full rounded-xl border border-slate-800"
              />
            )
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Нажми «Кадр» — PNG текущего кадра берётся прямо из DOM. Оверлеи safe zones в кадр
              не попадают (снимается только композиция).
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}