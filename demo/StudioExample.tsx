import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as Remotion from 'remotion';
import { PlayerSandbox } from '../src/player';
import type { PlayerSandboxRef } from '../src/player';

const STUDIO_CODE = [
  "import React from 'react';",
  "import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';",
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
  "      <div style={{ position: 'absolute', bottom: 80, color: '#ddb7ff', fontFamily: 'monospace' }}>",
  '        TikTok safe zone overlay',
  '      </div>',
  '    </AbsoluteFill>',
  '  );',
  '}',
].join('\n');

const panel: CSSProperties = {
  background: '#111726',
  border: '1px solid #222d42',
  borderRadius: 10,
  padding: 16,
};

export function StudioExample() {
  const playerRef = useRef<PlayerSandboxRef>(null);
  const [snapshot, setSnapshot] = useState('');
  const [status, setStatus] = useState('ready');

  const capture = async () => {
    try {
      const url = await playerRef.current?.takeSnapshot({ format: 'image/png' });
      if (url) setSnapshot(url);
      setStatus('snapshot taken');
    } catch (error) {
      setStatus(`snapshot failed: ${(error as Error).message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24, display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>browser-tsx-sandbox · Studio</h1>
          <p style={{ margin: 0, color: '#8ea2c9', fontSize: 14 }}>
            Smart Frame Retention, ref-API, скриншот кадра, safe zones, Ctrl+Wheel зум, headless-контролы.
          </p>
        </div>
        <a href="/" style={{ color: '#4fdbc8' }}>
          ← Player demo
        </a>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 16 }}>
        <section style={panel}>
          <PlayerSandbox.Root
            ref={playerRef}
            config={{
              code: STUDIO_CODE,
              modules: { remotion: Remotion },
              durationInFrames: 150,
              fps: 30,
              width: 1080,
              height: 1920,
              controls: false,
              loop: true,
              smartFrameRetention: true,
              delayRenderTimeoutMs: 3500,
              safeZone: ['tiktok-9x16', 'rule-of-thirds'],
              canvasControls: { enabled: true, minZoom: 0.25, maxZoom: 3, initialZoom: 0.5 },
              renderLoading: () => <div style={{ padding: 24, color: '#8ea2c9' }}>Compiling…</div>,
            }}
            style={{ maxHeight: '70vh' }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <PlayerSandbox.PlayButton
                style={{ padding: '8px 16px', background: '#4fdbc8', color: '#06231d', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
              />
              <PlayerSandbox.TimeDisplay format="both" style={{ color: '#dae2fd' }} />
              <PlayerSandbox.Timeline style={{ flex: 1, minWidth: 160 }} />
              <button
                onClick={capture}
                style={{ padding: '8px 12px', background: '#222d42', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Capture frame
              </button>
            </div>
          </PlayerSandbox.Root>
        </section>

        <aside style={panel}>
          <h3 style={{ marginTop: 0 }}>Poster snapshot</h3>
          <p style={{ color: '#8899ac', fontSize: 13 }}>status: {status}</p>
          {snapshot ? (
            snapshot.startsWith('data:image/svg+xml') ? (
              <div
                data-testid="snapshot-svg"
                style={{ borderRadius: 6, border: '1px solid #222d42', overflow: 'hidden' }}
                dangerouslySetInnerHTML={{
                  __html: decodeURIComponent(snapshot.slice(snapshot.indexOf(',') + 1)),
                }}
              />
            ) : (
              <img src={snapshot} alt="Snapshot" style={{ width: '100%', borderRadius: 6, border: '1px solid #222d42' }} />
            )
          ) : (
            <p style={{ color: '#8899ac', fontSize: 13 }}>
              Нажми «Capture frame» — PNG текущего кадра берётся прямо из DOM.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
