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
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  fontSize: 12,
  color: '#8ea2c9',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: '#06080f',
  color: '#dae2fd',
  border: '1px solid #1f2b45',
  borderRadius: 6,
  fontFamily: 'ui-monospace, Consolas, monospace',
  fontSize: 13,
};

const codeStyle: CSSProperties = {
  flex: 1,
  minHeight: 380,
  width: '100%',
  resize: 'vertical',
  background: '#06080f',
  color: '#dae2fd',
  border: '1px solid #1f2b45',
  borderRadius: 8,
  padding: 12,
  fontFamily: 'ui-monospace, Consolas, monospace',
  fontSize: 12.5,
  lineHeight: 1.55,
  tabSize: 2,
  outline: 'none',
};

const panelHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  minHeight: 20,
};

const captionStyle: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  color: '#8ea2c9',
  fontWeight: 600,
};

const metaStyle: CSSProperties = {
  fontSize: 11.5,
  color: '#5b6b8c',
  fontFamily: 'ui-monospace, Consolas, monospace',
};

export function App() {
  const [draft, setDraft] = useState(DEFAULT_CODE);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [durationInFrames, setDurationInFrames] = useState(180);
  const [fps, setFps] = useState(30);

  const modules = useMemo(() => ({ remotion: Remotion }), []);

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '24px 24px 40px',
        display: 'grid',
        gap: 20,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, letterSpacing: -0.2 }}>
            browser-tsx-sandbox · Remotion Player demo
          </h1>
          <p style={{ margin: 0, color: '#8ea2c9', fontSize: 14, maxWidth: 720 }}>
            Отредактируй TSX и нажми «Compile &amp; Preview» — код компилируется в браузере
            и сразу играет в Player.
          </p>
        </div>
        <a
          href="/studio.html"
          style={{ color: '#4fdbc8', fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Studio demo →
        </a>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {/* Editor */}
        <section style={panel}>
          <div style={panelHeader}>
            <span style={captionStyle}>Source</span>
            <span style={metaStyle}>{code.length} chars</span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'end',
              flexWrap: 'wrap',
            }}
          >
            <label style={{ ...labelStyle, flex: '0 0 130px' }}>
              durationInFrames
              <input
                type="number"
                min={1}
                value={durationInFrames}
                onChange={(e) => setDurationInFrames(Number(e.target.value) || 1)}
                style={inputStyle}
              />
            </label>

            <label style={{ ...labelStyle, flex: '0 0 90px' }}>
              fps
              <input
                type="number"
                min={1}
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) || 1)}
                style={inputStyle}
              />
            </label>

            <button
              type="button"
              onClick={() => setCode(draft)}
              style={{
                marginLeft: 'auto',
                padding: '9px 18px',
                borderRadius: 8,
                border: 'none',
                background: '#4fdbc8',
                color: '#06231d',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'transform .08s ease, background .15s ease',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Compile &amp; Preview
            </button>
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            style={codeStyle}
          />
        </section>

        {/* Preview */}
        <section style={panel}>
          <div style={panelHeader}>
            <span style={captionStyle}>Preview</span>
            <span style={metaStyle}>
              {durationInFrames}f · {fps}fps · {Math.round(durationInFrames / fps * 10) / 10}s
            </span>
          </div>

          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              background: '#000',
              border: '1px solid #1f2b45',
              borderRadius: 8,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
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
                renderLoading: () => (
                  <div style={{ padding: 24, color: '#8ea2c9' }}>Compiling…</div>
                ),
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
          </div>

          <p style={{ margin: 0, fontSize: 12, color: '#5b6b8c' }}>
            Рендер идёт в изолированном iframe — ошибки компиляции появятся прямо в плеере.
          </p>
        </section>
      </div>
    </div>
  );
}