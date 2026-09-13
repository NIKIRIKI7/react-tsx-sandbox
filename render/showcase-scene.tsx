import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Cpu, Zap, Sparkles, Activity } from 'lucide-react';
import { range, max } from 'd3';
import * as THREE from 'three';

export default function Showcase() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 16 } });

  const bars = range(0, 12).map((i) => Math.abs(Math.sin(i * 0.7 + frame / 18)));
  const peak = max(bars) ?? 0;
  const magnitude = new THREE.Vector3(3, 4, frame % 5).length();
  const icons = [Cpu, Zap, Sparkles, Activity];
  const colors = ['text-cyan-300', 'text-emerald-300', 'text-fuchsia-300', 'text-amber-300'];

  return (
    <AbsoluteFill className="bg-slate-950 text-white font-black items-center justify-center">
      <div
        className="flex flex-col items-center gap-8"
        style={{ transform: `scale(${enter})` }}
      >
        <h1 className="text-6xl tracking-tight text-emerald-400 uppercase">Sandbox Showcase</h1>

        <div className="grid grid-cols-4 gap-4">
          {icons.map((Icon, index) => (
            <div
              key={index}
              className="flex items-center justify-center w-24 h-24 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl"
            >
              <Icon className={`w-10 h-10 ${colors[index]}`} />
            </div>
          ))}
        </div>

        <div className="flex items-end gap-2 h-40">
          {bars.map((value, index) => (
            <div
              key={index}
              className="w-6 rounded-t bg-emerald-500"
              style={{ height: `${value * 100}%`, opacity: interpolate(value, [0, 1], [0.4, 1]) }}
            />
          ))}
        </div>

        <div className="font-mono text-lg text-slate-300">
          d3 peak = {peak.toFixed(3)} | three |v| = {magnitude.toFixed(3)} | frame {frame}
        </div>
      </div>
    </AbsoluteFill>
  );
}
