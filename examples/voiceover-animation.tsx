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
import { Cue, MusicLayer, SFXLayer, TrackLayer, useActiveCues } from 'browser-tsx-sandbox';
import { AudioLines, Mic, Music } from 'lucide-react';

// === ЕДИНЫЙ МАССИВ ТАЙМЛАЙНА (State редактора / вывод AI) ===
const cues: Cue<any>[] = [
  // Фоновая музыка (затихает под озвучку).
  {
    id: 'bgm',
    type: 'music',
    startFrame: 0,
    payload: { src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', volume: 0.7 },
  },

  // Реальная озвучка из examples/voice/voice_01.wav.
  {
    id: 'voice',
    type: 'voice',
    startFrame: 30,
    durationInFrames: 240,
    payload: { src: staticFile('voice/voice_01.wav') },
  },

  // Звуковые эффекты на таймкодах.
  {
    id: 'sfx-start',
    type: 'sfx',
    startFrame: 30,
    payload: { src: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg', volume: 0.8 },
  },
  {
    id: 'sfx-mid',
    type: 'sfx',
    startFrame: 150,
    payload: { src: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg', volume: 0.6 },
  },
  {
    id: 'sfx-end',
    type: 'sfx',
    startFrame: 265,
    payload: { src: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg', volume: 0.8 },
  },

  // Субтитры.
  { id: 'c1', type: 'caption', startFrame: 30, durationInFrames: 90, payload: { text: 'Привет! Это тестовая озвучка.' } },
  { id: 'c2', type: 'caption', startFrame: 120, durationInFrames: 90, payload: { text: 'Музыка затихает, пока говорит диктор.' } },
  { id: 'c3', type: 'caption', startFrame: 210, durationInFrames: 60, payload: { text: 'SFX играют точно по таймкоду.' } },

  // Бейдж микрофона поверх речи.
  { id: 'badge', type: 'badge', startFrame: 30, durationInFrames: 240, payload: {} },
];

export default function VoiceoverAnimationScene() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const voiceCues = cues.filter((cue) => cue.type === 'voice');

  // Ducking: пока говорит диктор, музыка уходит в фон.
  const ducking = (f: number) =>
    voiceCues.reduce((multiplier, voice) => {
      const start = voice.startFrame;
      const end = start + (voice.durationInFrames ?? 0);
      const local = interpolate(f, [start - 15, start, end, end + 15], [1, 0.2, 0.2, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      return Math.min(multiplier, local);
    }, 1);

  const isSpeaking = useActiveCues(cues, 'voice').length > 0;
  const caption = useActiveCues(cues, 'caption')[0]?.payload?.text;
  const titleIn = spring({ frame, fps, config: { damping: 14 } });

  // Эквалайзер: активнее во время речи.
  const bars = Array.from({ length: 36 }, (_, i) => {
    const base = isSpeaking ? 0.75 : 0.25;
    const wave = Math.abs(Math.sin(frame * 0.22 + i * 0.5));
    return 12 + wave * 110 * base;
  });

  return (
    <AbsoluteFill className="bg-slate-950 text-white font-sans items-center justify-center">
      {/* --- АУДИО --- */}
      <MusicLayer cues={cues} volumeDucking={ducking} />
      <SFXLayer cues={cues} globalVolume={0.8} />
      {voiceCues.map((cue) => (
        <Sequence key={cue.id} from={cue.startFrame} durationInFrames={cue.durationInFrames}>
          <Audio src={cue.payload.src} />
        </Sequence>
      ))}

      {/* --- ВИЗУАЛ --- */}
      <div className="absolute top-16 flex items-center gap-4" style={{ opacity: titleIn }}>
        <Music className="w-9 h-9 text-emerald-400" />
        <h1 className="text-5xl font-black uppercase tracking-widest text-slate-200">
          Voiceover Studio
        </h1>
        <AudioLines className="w-9 h-9 text-cyan-400" />
      </div>

      {/* Бейдж «идёт запись» на время речи. */}
      <TrackLayer
        cues={cues}
        type="badge"
        renderCue={() => (
          <div
            className="absolute top-52 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2 rounded-full border"
            style={{
              borderColor: 'rgba(244,63,94,0.6)',
              background: 'rgba(244,63,94,0.12)',
              transform: `translateX(-50%) scale(${1 + Math.sin(frame * 0.4) * 0.05})`,
            }}
          >
            <Mic className="w-5 h-5 text-rose-400" />
            <span className="text-rose-300 font-mono tracking-wider">REC</span>
          </div>
        )}
      />

      {/* Эквалайзер. */}
      <div className="flex items-end gap-1.5 h-56">
        {bars.map((height, i) => (
          <div
            key={i}
            className="w-2.5 rounded-full bg-gradient-to-t from-emerald-500 to-cyan-400"
            style={{ height }}
          />
        ))}
      </div>

      {/* Субтитры. */}
      <div className="absolute bottom-28 w-full flex justify-center px-16">
        {caption ? (
          <div className="px-8 py-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-3xl text-4xl font-bold text-center shadow-2xl">
            {caption}
          </div>
        ) : null}
      </div>

      {/* Прогресс. */}
      <div className="absolute bottom-0 left-0 h-1 bg-cyan-400" style={{ width: `${(frame / durationInFrames) * 100}%` }} />
    </AbsoluteFill>
  );
}
