import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as React from 'react';
import * as Remotion from 'remotion';
import * as ReactDOM from 'react-dom';
import * as Lucide from 'lucide-react';
import { PlayerSandbox } from '../src/player';
import { createTailwindPlugin } from '../src/plugins/tailwind-plugin';
import {
  configureLogger,
  defaultImporter,
  getErrorPhase,
  CompilerError,
  NetworkModuleError,
  RuntimeRenderError,
} from '../src';
import type { CompiledComponentInfo } from '../src';

const DEFAULT_CODE = [
  "import React from 'react';",
  "import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';",
  "import { Sparkles } from 'lucide-react';",
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
  "      <Sparkles size={28} color='#ddb7ff' style={{ position: 'absolute', top: 40, right: 40 }} />",
  "      <div style={{ position: 'absolute', bottom: 24, color: '#ddb7ff', fontFamily: 'monospace', fontSize: 18 }}>",
  '        frame {frame}',
  '      </div>',
  '    </AbsoluteFill>',
  '  );',
  '}',
].join('\n');

type LogLevel = 'info' | 'ok' | 'warn' | 'error';

interface DemoLog {
  id: number;
  at: string;
  level: LogLevel;
  title: string;
  detail?: string;
}

const LOG_COLORS: Record<LogLevel, string> = {
  info: '#5b6b8c',
  ok: '#4fdbc8',
  warn: '#e8b64c',
  error: '#ff6b6b',
};

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

function formatTime(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function describeError(error: Error): { level: LogLevel; title: string; detail: string } {
  const phase = getErrorPhase(error);
  const title = `[${phase}] ${error.name}`;
  const parts: string[] = [error.message];

  if (error instanceof NetworkModuleError) {
    parts.push(`Module: ${error.moduleName}`);
  }
  if (error instanceof CompilerError && error.line !== undefined) {
    parts.push(`Location: ${error.line + 1}:${(error.column ?? 0) + 1}`);
    if (error.snippet) parts.push(`Snippet:\n${error.snippet}`);
  }
  if (error instanceof RuntimeRenderError && error.componentStack) {
    parts.push(`Component stack:\n${error.componentStack}`);
  }
  if (error.cause) parts.push(`Cause: ${(error.cause as Error).message}`);
  if (error.stack) parts.push(`Stack:\n${error.stack}`);

  return { level: 'error', title, detail: parts.join('\n\n') };
}

export function App() {
  const [draft, setDraft] = useState(DEFAULT_CODE);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [durationInFrames, setDurationInFrames] = useState(180);
  const [fps, setFps] = useState(30);
  const [logs, setLogs] = useState<DemoLog[]>([]);
  const logId = useRef(0);
  const logsRef = useRef<HTMLDivElement | null>(null);

  const plugins = useMemo(() => [createTailwindPlugin()], []);

  useEffect(() => {
    configureLogger({ enabled: true, level: 'debug' });
  }, []);

  function pushLog(level: LogLevel, title: string, detail?: string): void {
    logId.current += 1;
    const entry: DemoLog = { id: logId.current, at: formatTime(), level, title, detail };
    if (level === 'error') {
      console.error(`[demo:${level}]`, title, detail ?? '');
    } else if (level === 'warn') {
      console.warn(`[demo:${level}]`, title, detail ?? '');
    } else {
      console.log(`[demo:${level}]`, title, detail ?? '');
    }
    setLogs((prev) => [...prev.slice(-199), entry]);
  }

  useEffect(() => {
    const el = logsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const toViteFsPath = (src: string): string => {
    const clean = src.replace(/^file:\/\/\//i, '');
    if (/^[a-zA-Z]:[\\/]/.test(clean)) {
      return '/@fs/' + clean.replace(/\\/g, '/');
    }
    return src;
  };

  const modules = useMemo(
    () => ({
      react: React,
      remotion: Remotion,
      'react-dom': ReactDOM,
      'lucide-react': Lucide,
    }),
    [],
  );

  const importer = useMemo(
    () =>
      async (url: string, signal?: AbortSignal): Promise<any> => {
        pushLog('info', `CDN request → ${url}`);
        try {
          const mod = await defaultImporter(url, signal);
          pushLog('ok', `CDN loaded <${url}>`);
          return mod;
        } catch (error) {
          pushLog('error', `CDN failed <${url}>`, (error as Error).message);
          throw error;
        }
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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
              {durationInFrames}f · {fps}fps · {Math.round((durationInFrames / fps) * 10) / 10}s
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
                importer,
                plugins,
                mediaResolver: toViteFsPath,
                durationInFrames,
                fps,
                width: 1280,
                height: 720,
                controls: true,
                loop: true,
                onError: (error) => {
                  const { title, detail } = describeError(error);
                  pushLog('error', `error · ${title}`, detail);
                },
                onCompiled: (info: CompiledComponentInfo) => {
                  const meta = info.metadata;
                  const dims = meta
                    ? `${meta.durationInFrames ?? '-'}f · ${meta.fps ?? '-'}fps · ${meta.width ?? '-'}×${meta.height ?? '-'}`
                    : 'scene metadata: none';
                  pushLog(
                    'ok',
                    `Compiled in ${info.executionTimeMs.toFixed(1)}ms`,
                    `Component: ${info.component?.displayName ?? info.component?.name ?? '(anonymous)'}\n${dims}`,
                  );
                },
                renderLoading: () => (
                  <div style={{ padding: 24, color: '#8ea2c9' }}>Compiling…</div>
                ),
                renderError: ({ error, isRuntime }) => {
                  const { title, detail } = describeError(error);
                  return (
                    <pre
                      data-testid="error-detail"
                      style={{
                        margin: 0,
                        padding: 16,
                        color: '#ff6b6b',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        fontSize: 12,
                        lineHeight: 1.5,
                        maxHeight: '100%',
                        overflow: 'auto',
                      }}
                    >
                      {isRuntime ? 'RUNTIME RENDER ERROR\n' : 'COMPILE ERROR\n'}
                      {title}
                      {'\n\n'}
                      {detail}
                    </pre>
                  );
                },
              }}
            />
          </div>

          <p style={{ margin: 0, fontSize: 12, color: '#5b6b8c' }}>
            Рендер идёт в изолированном iframe — ошибки компиляции появятся прямо в плеере.
          </p>
        </section>
      </div>

      {/* Diagnostics */}
      <section style={{ ...panel, gap: 8 }}>
        <div style={panelHeader}>
          <span style={captionStyle}>Diagnostics</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={metaStyle}>{logs.length} entries</span>
            <button
              type="button"
              onClick={() => setLogs([])}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #1f2b45',
                background: '#06080f',
                color: '#8ea2c9',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div
          ref={logsRef}
          data-testid="diagnostics"
          style={{
            maxHeight: 320,
            overflow: 'auto',
            background: '#06080f',
            border: '1px solid #1f2b45',
            borderRadius: 8,
            fontFamily: 'ui-monospace, Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {logs.length === 0 ? (
            <div style={{ padding: 12, color: '#5b6b8c' }}>
              Логов пока нет — нажми «Compile &amp; Preview».
            </div>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '4px 12px',
                  borderLeft: `3px solid ${LOG_COLORS[entry.level]}`,
                  color: '#dae2fd',
                }}
              >
                <span style={{ color: '#5b6b8c' }}>{entry.at}</span>{' '}
                <span style={{ color: LOG_COLORS[entry.level] }}>{entry.title}</span>
                {entry.detail ? (
                  <pre
                    style={{
                      margin: '4px 0 0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: '#8ea2c9',
                    }}
                  >
                    {entry.detail}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}