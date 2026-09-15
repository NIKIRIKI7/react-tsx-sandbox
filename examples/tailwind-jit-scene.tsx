import React from 'react';
import 'virtual:tailwind.css';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Cpu, Layers, Package, Zap } from 'lucide-react';

// Сцена-«каталог утилит»: рендерится ПЕСОЧНИЦЕЙ с createTailwindPlugin().
// Плагин перехватывает `import "virtual:tailwind.css"` через onResolve/onLoad,
// собирает классы из строковых токенов VFS и инжектит <style data-tailwind-jit>
// со scoped-классами.
const SWATCHES = [
  { cls: 'bg-rose-500', label: 'bg-rose-500' },
  { cls: 'bg-amber-400', label: 'bg-amber-400' },
  { cls: 'bg-emerald-500', label: 'bg-emerald-500' },
  { cls: 'bg-sky-500', label: 'bg-sky-500' },
  { cls: 'bg-violet-500', label: 'bg-violet-500' },
  { cls: 'bg-pink-400', label: 'bg-pink-400' },
];

const SPACING_BARS = [
  { width: 'w-8', value: '2' },
  { width: 'w-16', value: '4' },
  { width: 'w-24', value: '6' },
  { width: 'w-32', value: '8' },
  { width: 'w-40', value: '10' },
  { width: 'w-56', value: '14' },
];

const TYPE_LINES = [
  { size: 'text-xs', weight: 'font-light', text: 'text-xs · font-light' },
  { size: 'text-base', weight: 'font-medium', text: 'text-base · font-medium' },
  { size: 'text-2xl', weight: 'font-bold', text: 'text-2xl · font-bold' },
  { size: 'text-4xl', weight: 'font-black', text: 'text-4xl · font-black' },
];

export default function TailwindJitScene() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sweep = (frame / durationInFrames) * 1100;

  return (
    <AbsoluteFill className="relative bg-slate-950 items-center justify-center overflow-hidden font-sans">
      {/* Сканирующая полоса — «прогон коллектора» по исходнику. */}
      <div
        className="absolute top-0 h-1 w-40 bg-cyan-400/70 blur-sm"
        style={{ left: sweep - 80 }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 p-10">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-sm uppercase tracking-widest text-emerald-400">
            client-side jit
          </span>
        </div>

        <h1 className="text-7xl font-black uppercase tracking-tight text-white">
          TAILWIND{' '}
          <span style={{ color: '#22d3ee' }} className="text-7xl font-black">
            JIT
          </span>
        </h1>
        <div className="flex items-center gap-3 text-slate-400 font-mono text-sm">
          <Zap className="h-4 w-4 text-amber-400" />
          className → scoped-{'{'}style{'}'} за миллисекунды
          <Cpu className="h-4 w-4 text-cyan-400" />
        </div>

        <div className="grid w-full max-w-4xl grid-cols-3 gap-6">
          {/* Панель 1: палитра. */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Layers className="h-4 w-4 text-violet-400" /> palette
            </div>
            <div className="grid grid-cols-3 gap-3">
              {SWATCHES.map((swatch) => (
                <div
                  key={swatch.cls}
                  className={`${swatch.cls} h-14 rounded-lg border border-white/10 flex items-end justify-center p-1`}
                >
                  <span className="text-[9px] font-mono text-white/90">{swatch.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Панель 2: шкала отступов. */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Package className="h-4 w-4 text-emerald-400" /> spacing
            </div>
            <div className="flex flex-col items-start gap-3">
              {SPACING_BARS.map((bar) => (
                <div key={bar.value} className="flex items-center gap-3">
                  <span
                    className={`h-3 ${bar.width} rounded-full bg-cyan-400/90`}
                  />
                  <span className="font-mono text-xs text-slate-400">w-{bar.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Панель 3: типографика. */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Zap className="h-4 w-4 text-amber-400" /> type
            </div>
            <div className="flex flex-col gap-2">
              {TYPE_LINES.map((line) => (
                <div
                  key={line.text}
                  className={`${line.size} ${line.weight} tracking-tight text-slate-100`}
                >
                  {line.text}
                </div>
              ))}
            </div>
            <div className="mt-2 h-16 w-16 self-center rounded-3xl shadow-2xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center">
              <span className="h-6 w-6 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-6 py-3 font-mono text-sm text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          SCOPE __tsx_tw · CLASSES COLLECTED · FRAME {String(frame).padStart(3, '0')}
        </div>
      </div>
    </AbsoluteFill>
  );
}