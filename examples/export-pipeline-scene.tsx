import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Camera, Cpu, Download, Package, Zap } from 'lucide-react';

// Сцена про in-browser экспорт: воспроизводит пайплайн WebCodecs
// (захват кадров → VP9-энкод → EBML/WebM-муксер → download blob).
const STAGES = [
  { icon: Camera, name: 'CAPTURE', desc: 'canvas → VideoFrame', color: '#22d3ee' },
  { icon: Cpu, name: 'ENCODE', desc: 'VideoEncoder VP9', color: '#a78bfa' },
  { icon: Package, name: 'MUX', desc: 'EBML >> .webm', color: '#f59e0b' },
  { icon: Download, name: 'BLOB', desc: 'downloadExportBlob()', color: '#34d399' },
];

const FRAMES = [12, 38, 64, 90];

export default function ExportPipelineScene() {
  const frame = useCurrentFrame();
  const total = 150;
  const progress = Math.min(1, frame / total);

  // Сколько стадий полностью пройдено (текущая — в процессе).
  const activeIndex = Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length));
  const stageProgress = (progress * STAGES.length - activeIndex);
  const captured = FRAMES.filter((f) => frame >= f).length;

  return (
    <AbsoluteFill className="relative bg-slate-950 items-center justify-center overflow-hidden font-sans">
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-10 p-10">
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-sm uppercase tracking-widest text-emerald-400">
            zero backend · all in the tab
          </span>
          <h1 className="text-6xl font-black uppercase tracking-tight text-white">
            BROWSER <span style={{ color: '#22d3ee' }}>EXPORT</span> PIPELINE
          </h1>
        </div>

        {/* Стейджер: CAPTURE → ENCODE → MUX → BLOB. */}
        <div className="flex w-full items-start justify-between gap-2">
          {STAGES.map((stage, i) => {
            const done = i < activeIndex || (i === activeIndex && stageProgress >= 0.5);
            const running = i === activeIndex && stageProgress < 0.5;
            const Icon = stage.icon;
            return (
              <div key={stage.name} className="flex flex-1 flex-col items-center gap-3">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 "
                  style={{
                    borderColor: done ? stage.color : '#1e293b',
                    backgroundColor: done ? `${stage.color}1f` : 'rgba(15,23,42,0.8)',
                    boxShadow: done ? `0 0 ${18 + stageProgress * 16}px ${stage.color}55` : 'none',
                    transform: `scale(${running ? 1 + Math.sin(frame * 0.4) * 0.03 : 1})`,
                  }}
                >
                  <Icon className="h-9 w-9" style={{ color: done ? stage.color : '#475569' }} />
                </div>
                <div className="text-center">
                  <div className="text-lg font-black tracking-wide" style={{ color: done ? stage.color : '#64748b' }}>
                    {stage.name}
                  </div>
                  <div className="font-mono text-xs text-slate-500">{stage.desc}</div>
                </div>
                {i < STAGES.length - 1 && (
                  <div className="h-1 w-full self-center rounded bg-slate-800" style={{ maxWidth: 110 }}>
                    <div
                      className="h-1 rounded"
                      style={{ width: `${Math.max(0, Math.min(1, stageProgress * 3)) * 100}%`, backgroundColor: stage.color }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Общий прогресс-бар. */}
        <div className="w-full">
          <div className="flex items-center justify-between font-mono text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" /> FRAME {String(frame).padStart(3, '0')} / {total}
            </span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-3 rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: 'linear-gradient(90deg,#22d3ee,#a78bfa,#f59e0b,#34d399)',
              }}
            />
          </div>
        </div>

        {/* Киноплёнка захваченных кадров. */}
        <div className="flex w-full items-center gap-3 font-mono text-sm">
          <div className="flex items-center gap-2 text-slate-500">captured:</div>
          {FRAMES.map((f, i) => {
            const lit = frame >= f;
            return (
              <div key={f} className="flex flex-col items-center gap-1">
                <div
                  className="flex h-12 w-16 items-center justify-center rounded border text-xs"
                  style={{
                    borderColor: lit ? '#22d3ee' : '#1e293b',
                    backgroundColor: lit ? 'rgba(34,211,238,0.12)' : 'rgba(15,23,42,0.8)',
                    color: lit ? '#67e8f9' : '#475569',
                  }}
                >
                  #{i + 1}
                </div>
                <span className="text-xs" style={{ color: lit ? '#22d3ee' : '#334155' }}>@f{f}</span>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-400">
            WebCodecs · video/vp9 · EBML muxer · {captured}/{FRAMES.length} frames
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}