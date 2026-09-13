import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { AudioLines, Music, Sparkles, Zap } from 'lucide-react';

// 120 BPM при 30 fps => удар каждые 15 кадров.
const BEAT = 15;
const IMPACTS = [30, 45, 60, 75, 90, 105, 120, 135, 150, 165];
const COLORS = ['#f43f5e', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];

export default function AudioAnimationScene() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // На каждый «удар» музыка приглушается (ducking), звучит короткий pop.
  const duck = IMPACTS.reduce((acc, at) => {
    const distance = Math.abs(frame - at);
    return Math.max(acc, distance < 12 ? (12 - distance) / 12 : 0);
  }, 0);
  const musicVolume = 0.5 - duck * 0.34;
  const beatPhase = (frame % BEAT) / BEAT;

  const titleIn = spring({ frame, fps, config: { damping: 14 } });
  const titleOut = spring({ frame: frame - (durationInFrames - 40), fps, config: { damping: 14 } });
  const titleOpacity = titleIn - titleOut;

  const bars = Array.from({ length: 28 }, (_, i) => {
    const wave = Math.abs(Math.sin(frame * 0.18 + i * 0.55));
    return 10 + wave * 90 * (1 - beatPhase * 0.5);
  });

  return (
    <AbsoluteFill className="bg-slate-950 items-center justify-center font-sans overflow-hidden">
      {/* Фоновая музыка (плавно затихает на ударах). */}
      <Audio src={staticFile('audio/music.mp3')} volume={musicVolume} />

      {/* Звуковые акценты pop, синхронные с битом. */}
      {IMPACTS.map((at) => (
        <Sequence key={at} from={at} durationInFrames={24}>
          <Audio src={staticFile('audio/pop.ogg')} />
        </Sequence>
      ))}

      {/* Радиальное свечение, пульсирующее в такт. */}
      <div
        className="absolute rounded-full"
        style={{
          width: 900,
          height: 900,
          background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(2,6,23,0) 65%)',
          transform: `scale(${1 + beatPhase * 0.18})`,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10">
        <div className="flex items-center gap-4" style={{ opacity: titleOpacity }}>
          <Music className="w-10 h-10 text-fuchsia-400" />
          <h1 className="text-7xl font-black text-white uppercase tracking-tight">
            Sound &amp; Motion
          </h1>
          <Zap className="w-10 h-10 text-amber-400" />
        </div>

        {/* Точки, «выстреливающие» на каждый удар. */}
        <div className="flex items-center gap-6">
          {IMPACTS.map((at, i) => {
            const appear = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 180 } });
            const appears = frame >= at;
            return (
              <div
                key={at}
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: COLORS[i % COLORS.length],
                  transform: `scale(${appears ? appear * (1 + duck * 0.25) : 0})`,
                  opacity: appears ? 1 : 0,
                  boxShadow: `0 0 ${18 + duck * 40}px ${COLORS[i % COLORS.length]}`,
                }}
              >
                <Sparkles className="w-7 h-7 text-white/90" />
              </div>
            );
          })}
        </div>

        {/* Эквалайзер. */}
        <div className="flex items-end gap-1 h-32">
          {bars.map((height, i) => (
            <div
              key={i}
              className="w-2 rounded-full bg-gradient-to-t from-cyan-500 to-fuchsia-400"
              style={{ height }}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 text-slate-400 font-mono text-lg border border-slate-800 px-6 py-3 rounded-lg bg-slate-900">
          <AudioLines className="w-5 h-5 text-cyan-400" />
          FRAME {frame} | BEAT {(frame / BEAT).toFixed(2)} | MUSIC {(musicVolume * 100).toFixed(0)}%
        </div>
      </div>
    </AbsoluteFill>
  );
}
