import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { GitBranch, RefreshCcw, Radio, Zap } from 'lucide-react';

// Визуализация «модульного графа»: сцена показывает, что при горячем обновлении
// перекомпилируются только затронутые модули и их зависящие, а остальное кэшируется.
const APP = { id: 'app.tsx', x: 640, y: 130, deps: ['player.ts', 'theme.ts', 'labels.ts', 'hooks.ts', 'filters.ts', 'styles.ts'] };

const MODULES = [
  { id: 'player.ts', x: 300, y: 380 },
  { id: 'theme.ts', x: 476, y: 330 },
  { id: 'labels.ts', x: 640, y: 310 },
  { id: 'hooks.ts', x: 804, y: 330 },
  { id: 'styles.ts', x: 980, y: 380 },
  { id: 'filters.ts', x: 640, y: 500 },
];

const HMR_SWEEPS = [
  { frame: 30, target: 'labels.ts' },
  { frame: 60, target: 'hooks.ts' },
  { frame: 105, target: 'filters.ts' },
];

export default function HmrModuleGraphScene() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Текущий «горячий» модуль: рамка, где сработал HMR-свип.
  const active = HMR_SWEEPS.filter((s) => frame >= s.frame).slice(-1)[0] ?? null;
  const nextSweep = HMR_SWEEPS.find((s) => frame < s.frame) ?? null;
  const updateIndex = HMR_SWEEPS.filter((s) => frame >= s.frame).length;

  // Реакомпилированный набор = зависящие + сам целевой модуль (граница HMR).
  const hotSet = active ? [APP.id, active.target] : [];
  const keptCount = MODULES.length + 1 - hotSet.length;

  const progress = Math.min(1, (frame % 30) / 20);
  const appGlow = active ? 24 : 10;

  return (
    <AbsoluteFill className="relative bg-slate-950 items-center justify-center overflow-hidden font-sans">
      <div className="relative z-10 h-full w-full p-12">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="font-mono text-sm uppercase tracking-widest text-sky-400">
                live hot module graph
              </span>
            </div>
            <h1 className="text-6xl font-black uppercase tracking-tight text-white">
              HOT <span style={{ color: '#a78bfa' }}>MODULE</span> GRAPH
            </h1>
          </div>

          <div className="flex flex-col items-end gap-2 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 font-mono text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <RefreshCcw className="h-4 w-4 text-violet-400" /> UPDATE #{updateIndex}
            </div>
            {active ? (
              <>
                <div className="text-sky-300">recompiled: {hotSet.join(', ')}</div>
                <div className="text-slate-500">kept from cache: {keptCount} modules</div>
              </>
            ) : (
              <div className="text-slate-500">idle — watching files…</div>
            )}
            {nextSweep && (
              <div className="mt-1 flex items-center gap-2 text-emerald-400">
                <Radio className="h-3 w-3" /> next hot edge: {nextSweep.target}
              </div>
            )}
          </div>
        </div>

        <svg viewBox="0 0 1280 720" className="h-full w-full" style={{ position: 'absolute', inset: 0 }}>
          {/* Рёбра App → модули */}
          {APP.deps.map((depId) => {
            const leaf = MODULES.find((m) => m.id === depId)!;
            const hot = hotSet.includes(depId);
            return (
              <line
                key={depId}
                x1={APP.x}
                y1={APP.y + 40}
                x2={leaf.x}
                y2={leaf.y - 44}
                stroke={hot ? '#22d3ee' : '#334155'}
                strokeWidth={hot ? 3 : 1.5}
                strokeDasharray="6 6"
                strokeDashoffset={hot ? -progress * 24 : 0}
              />
            );
          })}

          {/* Узлы модулей */}
          {MODULES.map((mod) => {
            const hot = hotSet.includes(mod.id);
            const pulse = hot ? 1 + progress * 0.14 : 1;
            return (
              <g key={mod.id}>
                <circle
                  cx={mod.x}
                  cy={mod.y}
                  r={hot ? 52 : 44}
                  fill={hot ? 'rgba(34,211,238,0.08)' : 'rgba(15,23,42,0.9)'}
                  stroke={hot ? '#22d3ee' : '#1e293b'}
                  strokeWidth={hot ? 2.5 : 1.5}
                />
                {hot && <circle cx={mod.x} cy={mod.y} r={56} fill="none" stroke="#22d3ee" strokeWidth={1} opacity={0.5 + progress * 0.5} />}
                <text
                  x={mod.x}
                  y={mod.y + 4}
                  textAnchor="middle"
                  fill={hot ? '#67e8f9' : '#94a3b8'}
                  style={{ font: '14px ui-monospace, monospace' }}
                  transform={hot ? `scale(${pulse}) translate(${mod.x - mod.x * pulse}, ${mod.y - mod.y * pulse})` : undefined}
                >
                  {mod.id}
                </text>
              </g>
            );
          })}

          {/* Корневой узел */}
          <g>
            <circle
              cx={APP.x}
              cy={APP.y}
              r={hotSet.length ? 70 : 56}
              fill="rgba(139,92,246,0.10)"
              stroke="#8b5cf6"
              strokeWidth={2.5}
            />
            <circle cx={APP.x} cy={APP.y} r={hotSet.length ? 74 : 60} fill="none" stroke="#8b5cf6" strokeWidth={1} opacity={0.4} />
            <text x={APP.x} y={APP.y + 4} textAnchor="middle" fill="#c4b5fd" style={{ font: 'bold 15px ui-monospace, monospace' }}>
              {APP.id}
            </text>
          </g>
        </svg>

        <div
          className="absolute bottom-10 flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-6 py-3 font-mono text-sm text-slate-400"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            boxShadow: `0 0 ${appGlow}px rgba(139,92,246,${active ? 0.5 : 0.15})`,
          }}
        >
          <GitBranch className="h-4 w-4 text-violet-400" />
          BOUNDARY = CHANGED + DEPENDENTS · FRAME {String(frame).padStart(3, '0')} / {durationInFrames}
          <Zap className={`h-4 w-4 text-amber-400 ${active ? 'animate-pulse' : 'opacity-30'}`} />
        </div>
      </div>
    </AbsoluteFill>
  );
}