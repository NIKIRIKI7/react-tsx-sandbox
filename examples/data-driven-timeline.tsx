import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Cue, MusicLayer, SFXLayer, TrackLayer, useActiveCues } from 'browser-tsx-sandbox';
import { MessageCircle, Sparkles } from 'lucide-react';

// === ЕДИНЫЙ МАССИВ ТАЙМЛАЙНА (приходит из UI-редактора или от AI) ===
const timelineCues: Cue<any>[] = [
  // 1. Фоновая музыка (играет всю композицию).
  {
    id: 'bgm1',
    type: 'music',
    startFrame: 0,
    payload: { src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', volume: 0.8 },
  },

  // 2. Голосовая озвучка (диктор) — под неё музыка автоматически затихает.
  {
    id: 'voice1',
    type: 'voice',
    startFrame: 60,
    durationInFrames: 120,
    payload: { src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  },

  // 3. Звуковые эффекты.
  {
    id: 'sfx1',
    type: 'sfx',
    startFrame: 30,
    payload: { src: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg' },
  },
  {
    id: 'sfx2',
    type: 'sfx',
    startFrame: 180,
    payload: { src: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg', volume: 0.7 },
  },

  // 4. Субтитры.
  {
    id: 'sub1',
    type: 'caption',
    startFrame: 60,
    durationInFrames: 60,
    payload: { text: 'Добро пожаловать в песочницу!' },
  },
  {
    id: 'sub2',
    type: 'caption',
    startFrame: 120,
    durationInFrames: 60,
    payload: { text: 'Data-Driven таймлайн работает.' },
  },

  // 5. Визуальные стикеры.
  {
    id: 'st1',
    type: 'sticker',
    startFrame: 30,
    durationInFrames: 80,
    payload: { x: '18%', y: '28%', icon: 'MessageCircle' },
  },
  {
    id: 'st2',
    type: 'sticker',
    startFrame: 180,
    durationInFrames: 80,
    payload: { x: '68%', y: '28%', icon: 'Sparkles' },
  },
];

export default function DataDrivenTimelineScene() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Все войсоверы: по ним считаем плавный ducking для музыки.
  const voiceCues = timelineCues.filter((cue) => cue.type === 'voice');

  const duckingMultiplier = (f: number) =>
    voiceCues.reduce((multiplier, voice) => {
      const start = voice.startFrame;
      const end = start + (voice.durationInFrames ?? 0);
      const local = interpolate(
        f,
        [start - 15, start, end, end + 15],
        [1, 0.15, 0.15, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );
      return Math.min(multiplier, local);
    }, 1);

  const currentCaption = useActiveCues(timelineCues, 'caption')[0]?.payload?.text;
  const titleIn = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill className="bg-slate-950 text-white font-sans items-center justify-center">
      {/* --- АУДИО СЛОИ --- */}
      <MusicLayer cues={timelineCues} volumeDucking={duckingMultiplier} />
      <SFXLayer cues={timelineCues} globalVolume={0.9} />
      {voiceCues.map((cue) => (
        <Sequence key={cue.id} from={cue.startFrame} durationInFrames={cue.durationInFrames}>
          <Audio src={cue.payload.src} />
        </Sequence>
      ))}

      {/* --- ВИЗУАЛЬНЫЕ СЛОИ --- */}
      <h1
        className="text-6xl font-black text-slate-700 absolute top-20 uppercase tracking-widest"
        style={{ opacity: titleIn }}
      >
        Full Timeline Demo
      </h1>

      <TrackLayer
        cues={timelineCues}
        type="sticker"
        renderCue={(cue) => {
          const { x, y, icon } = cue.payload;
          const Icon = icon === 'Sparkles' ? Sparkles : MessageCircle;
          const scale = spring({ frame: frame - cue.startFrame, fps, config: { damping: 12 } });
          return (
            <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${scale})` }}>
              <Icon
                size={140}
                className={icon === 'Sparkles' ? 'text-amber-400' : 'text-fuchsia-400'}
              />
            </div>
          );
        }}
      />

      <div className="absolute bottom-20 w-full flex justify-center">
        {currentCaption ? (
          <div className="px-8 py-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-3xl text-4xl font-bold shadow-2xl">
            {currentCaption}
          </div>
        ) : null}
      </div>

      {/* Прогресс таймлайна. */}
      <div className="absolute bottom-0 left-0 h-1 bg-cyan-400" style={{ width: `${(frame / durationInFrames) * 100}%` }} />
    </AbsoluteFill>
  );
}
