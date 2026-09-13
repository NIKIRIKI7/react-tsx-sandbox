import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Mic, Music, Volume2 } from 'lucide-react';

// Таймлайн: озвучка начинается на 60 кадре (2 c) и длится 180 кадров (6 c).
const VOICE_START = 60;
const VOICE_LENGTH = 180;
const VOICE_END = VOICE_START + VOICE_LENGTH;

export default function AudioDuckingScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Audio Ducking: фоновая музыка плавно затихает, пока говорит диктор.
  const bgmVolume = interpolate(
    frame,
    [VOICE_START - 20, VOICE_START, VOICE_END, VOICE_END + 20],
    [0.8, 0.15, 0.15, 0.8],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const isSpeaking = frame >= VOICE_START && frame <= VOICE_END;

  // Пульсация индикатора голоса + анимация появления.
  const pulse = isSpeaking ? 1 + Math.sin(frame * 0.5) * 0.18 : 1;
  const voiceOpacity =
    spring({ frame: frame - VOICE_START, fps, config: { damping: 12 } }) -
    spring({ frame: frame - VOICE_END, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill className="bg-slate-950 items-center justify-center font-sans">
      {/* 1. Фоновая музыка: играет всю композицию, громкость управляется ducking'ом. */}
      <Audio src={staticFile('audio/bgm.wav')} volume={bgmVolume} />

      {/* 2. Голосовая озвучка: появляется только на своём отрезке таймлайна. */}
      <Sequence from={VOICE_START} durationInFrames={VOICE_LENGTH}>
        <Audio src={staticFile('audio/voice.wav')} volume={1} />
      </Sequence>

      <div className="flex flex-col items-center gap-12">
        <h1 className="text-5xl font-black text-white uppercase tracking-widest">
          Audio Ducking Demo
        </h1>

        <div className="flex items-center gap-16">
          {/* Индикатор музыки: кольцо сжимается вместе с громкостью. */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-32 h-32 rounded-full bg-slate-800 border-4 border-emerald-500 flex items-center justify-center">
              <Music className="w-12 h-12 text-emerald-400" />
              <div
                className="absolute inset-0 rounded-full border-4 border-emerald-400 opacity-50"
                style={{ transform: `scale(${1 + bgmVolume * 0.5})` }}
              />
            </div>
            <div className="text-emerald-400 font-mono text-xl">
              BGM: {(bgmVolume * 100).toFixed(0)}%
            </div>
          </div>

          <Volume2 className="w-8 h-8 text-slate-600" />

          {/* Индикатор озвучки: пульсирует, пока диктор говорит. */}
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative w-32 h-32 rounded-full bg-slate-800 border-4 border-fuchsia-500 flex items-center justify-center"
              style={{ transform: `scale(${pulse})`, opacity: isSpeaking ? 1 : 0.5 }}
            >
              <Mic className="w-12 h-12 text-fuchsia-400" />
              <div
                className="absolute inset-0 rounded-full bg-fuchsia-500"
                style={{ opacity: voiceOpacity * 0.2 }}
              />
            </div>
            <div className="text-fuchsia-400 font-mono text-xl">
              VO: {isSpeaking ? '100%' : 'Muted'}
            </div>
          </div>
        </div>

        <div className="text-slate-400 font-mono text-lg mt-8 border border-slate-800 px-6 py-3 rounded-lg bg-slate-900">
          FRAME {frame} | STATUS: {isSpeaking ? 'SPEAKING' : 'MUSIC ONLY'}
        </div>
      </div>
    </AbsoluteFill>
  );
}
