import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import * as Remotion from 'remotion';
import { PlayerSandbox } from '../src/player';

const DEFAULT_CODE = [
  "import React from 'react';",
  "import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';",
  '',
  'export default function Scene() {',
  '  const frame = useCurrentFrame();',
  '  const { fps } = useVideoConfig();',
  '  const scale = spring({ frame, fps, config: { damping: 12 } });',
  "  const x = interpolate(frame, [0, 120], [-300, 300], { extrapolateRight: 'clamp' });",
  '',
  '  return (',
  "    <AbsoluteFill style={{ backgroundColor: '#0b1326', justifyContent: 'center', alignItems: 'center' }}>",
  '      <div',
  '        style={{',
  '          transform: `translateX(${x}px) scale(${scale})`,',
  "          color: '#4fdbc8',",
  "          fontFamily: 'Arial, sans-serif',",
  '          fontSize: 72,',
  '          fontWeight: 900,',
  '          letterSpacing: 4,',
  '        }}',
  '      >',
  '        QWEN 3.8',
  '      </div>',
  "      <div style={{ position: 'absolute', bottom: 24, color: '#ddb7ff', fontFamily: 'monospace', fontSize: 18 }}>",
  '        frame {frame}',
  '      </div>',
  '    </AbsoluteFill>',
  '  );',
  '}',
].join('\n');

const panel: CSSProperties = {
  background: '#0f1626',
  border: '1px solid #1f2b45',
  borderRadius: 12,
  padding: 16,
};

export function App() {
  const [draft, setDraft] = useState(DEFAULT_CODE);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [durationInFrames, setDurationInFrames] = useState(180);
  const [fps, setFps] = useState(30);

  const modules = useMemo(() => ({ remotion: Remotion }), []);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24, display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>browser-tsx-sandbox · Remotion Player demo</h1>
          <p style={{ margin: 0, color: '#8ea2c9', fontSize: 14 }}>
            Отредактируй TSX и нажми «Compile &amp; Preview» — код компилируется в браузере и сразу играет в Player.
          </p>
        </div>
        <a href="/studio.html" style={{ color: '#4fdbc8' }}>
          Studio demo →
        </a>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
        <section style={panel}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#8ea2c9' }}>
              durationInFrames
              <input
                type="number"
                min={1}
                value={durationInFrames}
                onChange={(e) => setDurationInFrames(Number(e.target.value) || 1)}
                style={{ width: 130, padding: 6 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#8ea2c9' }}>
              fps
              <input
                type="number"
                min={1}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) || 1)}
                style={{ width: 90, padding: 6 }}
              />
            </label>
            <button
              onClick={() => setCode(draft)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#4fdbc8',
                color: '#06231d',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Compile &amp; Preview
            </button>
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={26}
            style={{
              width: '100%',
              resize: 'vertical',
              background: '#06080f',
              color: '#dae2fd',
              border: '1px solid #1f2b45',
              borderRadius: 8,
              padding: 12,
              fontFamily: 'ui-monospace, Consolas, monospace',
              fontSize: 12.5,
              lineHeight: 1.5,
            }}
          />
        </section>

        <section style={panel}>
          <PlayerSandbox
            config={{
              code,
              modules,
              durationInFrames,
              fps,
              width: 1280,
              height: 720,
              controls: true,
              loop: true,
              renderLoading: () => <div style={{ padding: 24, color: '#8ea2c9' }}>Compiling…</div>,
              renderError: ({ error }) => (
                <pre
                  style={{
                    margin: 0,
                    padding: 16,
                    color: '#ff6b6b',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    fontSize: 12.5,
                  }}
                >
                  {error.message}
                </pre>
              ),
            }}
          />
        </section>
      </div>
    </div>
  );
}
