import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
  OffthreadVideo,
} from 'remotion';
import {
  Cpu,
  Zap,
  Activity,
  Shield,
  Lock,
  Unlock,
  Server,
  Globe,
  Database,
  HardDrive,
  Radio,
  Sparkles,
  Terminal,
  Layers,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export const compositionConfig = {
  id: 'Scene',
  durationInFrames: 1177,
  fps: 30,
  width: 1920,
  height: 1080,
};

const COLORS = {
  primary: '#ddb7ff',
  secondary: '#4fdbc8',
  background: '#0b1326',
  surface: '#171f33',
  accent: '#ffb4ab',
  text: '#dae2fd',
} as const;

const TYPOGRAPHY = {
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
} as const;

// ==========================================
// FRAGMENT 1: B-ROLL (00:00.00 - 00:05.03)
// ==========================================
const Fragment1Video: React.FC = () => {
  return (
    <AbsoluteFill className="overflow-hidden" style={{ backgroundColor: COLORS.background }}>
      <OffthreadVideo
        src="C:\\Users\\mcniki\\Videos\\video\\qwen\\assets\\b-roll\\source1_0000_0004.mp4"
        className="w-full h-full object-cover"
      />
      <AbsoluteFill className="bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />
    </AbsoluteFill>
  );
};

// ==========================================
// FRAGMENT 2: GLOBAL TOPOLOGY & MONOPOLY SCHEMATIC (00:05.03 - 00:10.05)
// ==========================================
const Fragment2GlobalMap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & camera drift
  const enterProgress = spring({ frame, fps, config: { damping: 200 } });
  const mapZoom = interpolate(frame, [0, 151], [1.0, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const mapPanX = interpolate(frame, [0, 151], [-20, 20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Pulse & scanning radar
  const scanAngle = (frame * 2.4) % 360;
  const pulseWave = (Math.sin(frame / 6) + 1) / 2;

  // Trajectory arc animations
  const arcDashOffset = interpolate(frame, [15, 100], [1200, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Nodes data
  const localNodes = [
    { x: 380, y: 340, name: 'FRANKFURT // NODE 01', latency: '1.2ms' },
    { x: 490, y: 560, name: 'TOKYO // NODE 02', latency: '0.8ms' },
    { x: 740, y: 720, name: 'SINGAPORE // NODE 03', latency: '1.5ms' },
    { x: 260, y: 680, name: 'SÃO PAULO // NODE 04', latency: '2.1ms' },
    { x: 820, y: 410, name: 'SYDNEY // NODE 05', latency: '1.9ms' },
    { x: 620, y: 280, name: 'SEOUL // NODE 06', latency: '0.6ms' },
  ];

  return (
    <AbsoluteFill
      className="overflow-hidden"
      style={{ backgroundColor: COLORS.background, fontFamily: TYPOGRAPHY.fontFamily }}
    >
      {/* Background Matrix Grid */}
      <AbsoluteFill
        style={{
          opacity: 0.18,
          backgroundImage: `
            linear-gradient(to right, ${COLORS.primary}15 1px, transparent 1px),
            linear-gradient(to bottom, ${COLORS.primary}15 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Atmospheric Radial Glows */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full blur-[140px] pointer-events-none"
        style={{
          backgroundColor: `${COLORS.primary}12`,
          left: '10%',
          top: '20%',
          transform: `scale(${1 + pulseWave * 0.15})`,
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none"
        style={{
          backgroundColor: `${COLORS.secondary}14`,
          right: '15%',
          bottom: '15%',
          transform: `scale(${1.1 - pulseWave * 0.1})`,
        }}
      />

      {/* Content & SVG Map Canvas */}
      <AbsoluteFill
        className="flex items-center justify-center p-16"
        style={{
          transform: `scale(${mapZoom}) translate(${mapPanX}px, 0px)`,
          opacity: enterProgress,
        }}
      >
        <svg
          viewBox="0 0 1000 600"
          className="w-full h-full max-w-[1500px]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle World Map Dot Matrix / Continents Geometry */}
          <g opacity="0.25">
            {/* North America / US Cluster */}
            <path
              d="M150 180 Q 220 160 300 210 T 260 340 T 170 300 Z"
              fill={COLORS.primary}
              fillOpacity="0.2"
              stroke={COLORS.primary}
              strokeWidth="1"
            />
            {/* Europe */}
            <path
              d="M440 170 Q 520 160 560 220 T 480 280 T 420 220 Z"
              fill={COLORS.primary}
              fillOpacity="0.15"
              stroke={COLORS.primary}
              strokeWidth="1"
            />
            {/* Asia */}
            <path
              d="M580 180 Q 750 170 820 280 T 700 420 T 560 320 Z"
              fill={COLORS.primary}
              fillOpacity="0.18"
              stroke={COLORS.primary}
              strokeWidth="1"
            />
            {/* South America & Australia */}
            <path
              d="M260 380 Q 320 400 300 520 T 240 460 Z"
              fill={COLORS.primary}
              fillOpacity="0.15"
              stroke={COLORS.primary}
              strokeWidth="1"
            />
            <path
              d="M780 440 Q 860 450 840 540 T 760 500 Z"
              fill={COLORS.primary}
              fillOpacity="0.15"
              stroke={COLORS.primary}
              strokeWidth="1"
            />
          </g>

          {/* Radar Sweep Effect */}
          <g transform="translate(230, 250)">
            <circle
              r="220"
              stroke={COLORS.primary}
              strokeWidth="1"
              strokeDasharray="4 6"
              opacity="0.3"
            />
            <circle
              r="140"
              stroke={COLORS.primary}
              strokeWidth="1"
              strokeDasharray="2 4"
              opacity="0.4"
            />
            <line
              x1="0"
              y1="0"
              x2={220 * Math.cos((scanAngle * Math.PI) / 180)}
              y2={220 * Math.sin((scanAngle * Math.PI) / 180)}
              stroke={COLORS.secondary}
              strokeWidth="2"
              opacity="0.7"
            />
          </g>

          {/* Centralized US Cloud Datacenter Hub */}
          <g transform="translate(230, 250)">
            {/* Pulsing Concentric Energy Rings */}
            <circle
              r={38 + pulseWave * 16}
              fill="none"
              stroke={COLORS.accent}
              strokeWidth="2"
              opacity={0.6 - pulseWave * 0.4}
            />
            <circle
              r={22 + pulseWave * 8}
              fill="none"
              stroke={COLORS.primary}
              strokeWidth="2"
              opacity="0.8"
            />
            <circle r="14" fill={COLORS.accent} />
            <circle r="6" fill="#ffffff" />
            <text
              x="26"
              y="-12"
              fill={COLORS.accent}
              fontSize="14"
              fontWeight="900"
              letterSpacing="2"
            >
              US MEGA-DATACENTERS
            </text>
            <text
              x="26"
              y="6"
              fill={COLORS.text}
              fontSize="10"
              opacity="0.7"
              fontFamily="monospace"
            >
              CENTRALIZED CLOUD MONOPOLY [98.4%]
            </text>
          </g>

          {/* Dynamic Arc Pathways to Distributed Local Nodes */}
          {localNodes.map((node, index) => {
            const arcProgress = spring({
              frame: frame - index * 6,
              fps,
              config: { damping: 200 },
            });
            return (
              <g key={index} opacity={arcProgress}>
                {/* Arc Line */}
                <path
                  d={`M 230 250 Q ${(230 + node.x) / 2} ${(250 + node.y) / 2 - 70} ${node.x} ${node.y}`}
                  fill="none"
                  stroke={COLORS.secondary}
                  strokeWidth="2"
                  strokeDasharray="8 6"
                  strokeDashoffset={arcDashOffset}
                  opacity="0.75"
                />

                {/* Local Node Pointer */}
                <g transform={`translate(${node.x}, ${node.y})`}>
                  <circle
                    r={12 + Math.sin((frame + index * 10) / 5) * 3}
                    fill="none"
                    stroke={COLORS.secondary}
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                  <circle r="5" fill={COLORS.secondary} />
                  <circle r="2" fill="#ffffff" />
                  <text
                    x="12"
                    y="4"
                    fill={COLORS.secondary}
                    fontSize="9"
                    fontWeight="800"
                    letterSpacing="1"
                    fontFamily="monospace"
                  >
                    {node.name}
                  </text>
                  <text
                    x="12"
                    y="16"
                    fill={COLORS.text}
                    fontSize="8"
                    opacity="0.6"
                    fontFamily="monospace"
                  >
                    BUS: {node.latency}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* Kinetic Header & Telemetry Overlay */}
      <AbsoluteFill className="pointer-events-none p-16 flex flex-col justify-between">
        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div
            style={{
              transform: `translateY(${interpolate(frame, [0, 30], [-40, 0], {
                easing: Easing.out(Easing.cubic),
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px)`,
              opacity: enterProgress,
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className="px-3 py-1 text-xs font-black tracking-widest uppercase rounded"
                style={{ backgroundColor: `${COLORS.primary}25`, color: COLORS.primary }}
              >
                INFRASTRUCTURE ARCHITECTURE
              </span>
              <span className="text-xs font-mono tracking-wider" style={{ color: COLORS.secondary }}>
                LIVE TOPOLOGY MAP
              </span>
            </div>
            <h1 className="text-5xl font-black uppercase tracking-tight text-white m-0">
              Глобальная сеть дата-центров
            </h1>
            <p className="text-xl mt-1 font-medium" style={{ color: COLORS.text, opacity: 0.8 }}>
              Монополия облачных гигантов против суверенных локальных вычислений
            </p>
          </div>

          {/* Right Live Ticker Badge */}
          <div
            className="flex items-center gap-4 px-6 py-4 rounded-xl border border-white/10"
            style={{
              backgroundColor: `${COLORS.surface}CC`,
              backdropFilter: 'blur(16px)',
              opacity: enterProgress,
            }}
          >
            <Radio className="w-6 h-6 animate-pulse" style={{ color: COLORS.secondary }} />
            <div>
              <div className="text-xs font-mono uppercase text-neutral-400">STATUS</div>
              <div className="text-sm font-bold text-white tracking-wide">
                DECENTRALIZED SHIFT ACTIVE
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Metrics Bar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-8">
            <div
              className="p-4 px-6 rounded-lg border border-white/10"
              style={{ backgroundColor: `${COLORS.surface}AA` }}
            >
              <div className="text-xs font-mono uppercase text-neutral-400">CLOUD LOCK-IN</div>
              <div className="text-2xl font-black mt-1" style={{ color: COLORS.accent }}>
                PROPRIETARY APIS
              </div>
            </div>
            <div
              className="p-4 px-6 rounded-lg border border-white/10"
              style={{ backgroundColor: `${COLORS.surface}AA` }}
            >
              <div className="text-xs font-mono uppercase text-neutral-400">LOCAL TOPOLOGY</div>
              <div className="text-2xl font-black mt-1" style={{ color: COLORS.secondary }}>
                100% AIR-GAPPED READY
              </div>
            </div>
          </div>

          <div className="text-right font-mono text-xs opacity-50" style={{ color: COLORS.text }}>
            SYSTEM: QWEN_3.8_TOPOLOGY_LAYER
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ==========================================
// FRAGMENT 3: SERVER RACKS LOCKED & CROSSED OUT (00:10.05 - 00:15.58)
// ==========================================
const Fragment3ServerMonopoly: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const enterSpring = spring({ frame, fps, config: { damping: 200 } });
  const zoom = interpolate(frame, [0, 166], [1.0, 1.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Red Strikethrough Laser Animation
  const strikeStartFrame = 25;
  const strikeProgress = spring({
    frame: frame - strikeStartFrame,
    fps,
    config: { mass: 0.6, stiffness: 220, damping: 18 },
  });
  const strikeWidth = interpolate(strikeProgress, [0, 1], [0, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slashOpacity = interpolate(frame - strikeStartFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shake impact on strike
  const shake =
    frame >= strikeStartFrame && frame <= strikeStartFrame + 18
      ? Math.sin(frame * 2.8) * 8 * (1 - (frame - strikeStartFrame) / 18)
      : 0;

  // Server rack counts
  const racks = [0, 1, 2, 3, 4];

  return (
    <AbsoluteFill
      className="overflow-hidden"
      style={{ backgroundColor: COLORS.background, fontFamily: TYPOGRAPHY.fontFamily }}
    >
      {/* Background Split & Radial Light */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, #1c0e1e 0%, ${COLORS.background} 80%)`,
        }}
      />

      {/* Grid Floor Perspective */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, ${COLORS.accent}20 1px, transparent 1px), linear-gradient(to bottom, ${COLORS.accent}20 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          transform: 'perspective(600px) rotateX(60deg) translateY(200px)',
        }}
      />

      {/* Server Racks Array */}
      <AbsoluteFill
        className="flex items-center justify-center gap-8 px-20"
        style={{
          transform: `scale(${zoom}) translate(${shake}px, ${shake * 0.5}px)`,
          opacity: enterSpring,
        }}
      >
        {racks.map((rackIdx) => {
          const rackPop = spring({
            frame: frame - rackIdx * 4,
            fps,
            config: { damping: 24, stiffness: 140 },
          });
          return (
            <div
              key={rackIdx}
              className="relative w-72 h-[680px] rounded-xl border border-white/10 flex flex-col justify-between p-4 shadow-2xl overflow-hidden"
              style={{
                backgroundColor: COLORS.surface,
                transform: `scale(${rackPop}) translateY(${(rackIdx % 2 === 0 ? 0 : 20)}px)`,
                boxShadow: `0 30px 80px rgba(0,0,0,0.8), inset 0 0 30px ${COLORS.background}`,
              }}
            >
              {/* Rack Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5" style={{ color: COLORS.accent }} />
                  <span className="text-xs font-mono font-bold tracking-wider text-white">
                    CLUSTER_A{rackIdx + 1}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: frame > strikeStartFrame ? COLORS.accent : COLORS.secondary,
                    }}
                  />
                  <span
                    className="text-[10px] font-mono"
                    style={{
                      color: frame > strikeStartFrame ? COLORS.accent : COLORS.secondary,
                    }}
                  >
                    {frame > strikeStartFrame ? 'LOCKED' : 'BUSY'}
                  </span>
                </div>
              </div>

              {/* Server Blade Units */}
              <div className="flex flex-col gap-2 my-auto">
                {Array.from({ length: 9 }).map((_, bladeIdx) => (
                  <div
                    key={bladeIdx}
                    className="h-10 rounded bg-neutral-900/80 border border-white/5 flex items-center justify-between px-3"
                  >
                    {/* Activity LEDs */}
                    <div className="flex gap-1.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            (frame + bladeIdx * 3) % 8 === 0 ? COLORS.accent : `${COLORS.accent}40`,
                        }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            (frame + bladeIdx * 4) % 6 === 0
                              ? COLORS.primary
                              : `${COLORS.primary}30`,
                        }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            (frame + bladeIdx * 5) % 10 === 0
                              ? COLORS.secondary
                              : `${COLORS.secondary}30`,
                        }}
                      />
                    </div>

                    {/* Vents */}
                    <div className="flex gap-1">
                      <div className="w-12 h-1 bg-white/10 rounded" />
                      <div className="w-6 h-1 bg-white/10 rounded" />
                    </div>

                    {/* Status metric */}
                    <span className="text-[9px] font-mono text-neutral-500">
                      SLOT_{bladeIdx < 10 ? `0${bladeIdx}` : bladeIdx}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rack Footer / PSU */}
              <div className="border-t border-white/10 pt-3 flex items-center justify-between text-[10px] font-mono text-neutral-400">
                <span>400V DUAL PSU</span>
                <span style={{ color: COLORS.accent }}>RESTRICTED CLOUD</span>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Giant Diagonal Strikethrough Laser Slash */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
        style={{
          opacity: slashOpacity,
        }}
      >
        {/* Main Red Warning Beam */}
        <div
          className="h-8 bg-red-500 flex items-center justify-center shadow-[0_0_80px_#ff1744] transform -rotate-12"
          style={{
            width: `${strikeWidth}%`,
            borderTop: '2px solid #ffffff',
            borderBottom: '2px solid #ffffff',
          }}
        >
          <span className="text-black font-black text-xl tracking-[0.4em] uppercase whitespace-nowrap px-8">
            ⛔ ЗАМКНУТЫЕ ОБЛАЧНЫЕ КЛАСТЕРЫ ⛔
          </span>
        </div>

        {/* Cross Slash */}
        <div
          className="absolute h-8 bg-red-500 flex items-center justify-center shadow-[0_0_80px_#ff1744] transform rotate-12"
          style={{
            width: `${strikeWidth}%`,
            borderTop: '2px solid #ffffff',
            borderBottom: '2px solid #ffffff',
          }}
        />
      </div>

      {/* Massive Kinetic Typography Center Overlay */}
      <AbsoluteFill className="pointer-events-none p-16 flex flex-col justify-between z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8" style={{ color: COLORS.accent }} />
            <span className="font-mono text-sm tracking-widest uppercase" style={{ color: COLORS.accent }}>
              MONOPOLY PARADIGM // BREACHED
            </span>
          </div>
          <div className="px-4 py-2 rounded-full border border-red-500/40 bg-red-950/40 text-red-300 font-mono text-xs tracking-wider">
            CLOSED ACCESS: NULLIFIED
          </div>
        </div>

        {/* Central Kinetic Label */}
        <div className="text-center my-auto">
          <h2
            className="text-7xl font-black uppercase tracking-tighter text-white m-0 drop-shadow-[0_20px_50px_rgba(0,0,0,0.9)]"
            style={{
              transform: `translateY(${interpolate(frame, [0, 40], [60, 0], {
                easing: Easing.out(Easing.cubic),
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px)`,
            }}
          >
            КОНЕЦ ОБЛАЧНОГО КОНТРОЛЯ
          </h2>
          <p
            className="text-2xl mt-4 font-mono font-bold tracking-widest uppercase"
            style={{ color: COLORS.primary }}
          >
            Интеллект больше не заперт в чужих серверах
          </p>
        </div>

        {/* Bottom Stats */}
        <div className="flex justify-between items-end">
          <div className="text-xs font-mono text-neutral-400">
            PROPRIETARY CLOUD STACK: <span className="text-red-400 font-bold">DEPRECATED</span>
          </div>
          <div className="text-xs font-mono" style={{ color: COLORS.secondary }}>
            TRANSITION TO LOCAL WEIGHTS: 100%
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ==========================================
// FRAGMENT 4: B-ROLL (00:15.58 - 00:21.11)
// ==========================================
const Fragment4Video: React.FC = () => {
  return (
    <AbsoluteFill className="overflow-hidden" style={{ backgroundColor: COLORS.background }}>
      <OffthreadVideo
        src="C:\\Users\\mcniki\\Videos\\video\\qwen\\assets\\b-roll\\source1_0004_0008.mp4"
        className="w-full h-full object-cover"
      />
      <AbsoluteFill className="bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />
    </AbsoluteFill>
  );
};

// ==========================================
// FRAGMENT 5: B-ROLL (00:21.11 - 00:26.64)
// ==========================================
const Fragment5Video: React.FC = () => {
  return (
    <AbsoluteFill className="overflow-hidden" style={{ backgroundColor: COLORS.background }}>
      <OffthreadVideo
        src="C:\\Users\\mcniki\\Videos\\video\\qwen\\assets\\b-roll\\source1_0112_0125.mp4"
        className="w-full h-full object-cover"
      />
      <AbsoluteFill className="bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />
    </AbsoluteFill>
  );
};

// ==========================================
// FRAGMENT 6: LOCAL NEURAL CORE ON PC (00:26.64 - 00:33.18)
// ==========================================
const Fragment6NeuralCore: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterSpring = spring({ frame, fps, config: { damping: 200 } });
  const coreZoom = interpolate(frame, [0, 196], [1.0, 1.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Neural Ring Rotations
  const rot1 = frame * 0.8;
  const rot2 = -frame * 1.2;
  const rot3 = frame * 0.4;

  // Flow of open weights tensors into core
  const tensorProgress = spring({ frame: frame - 15, fps, config: { damping: 30, stiffness: 90 } });
  const pulseCore = (Math.sin(frame / 5) + 1) / 2;

  return (
    <AbsoluteFill
      className="overflow-hidden"
      style={{ backgroundColor: COLORS.background, fontFamily: TYPOGRAPHY.fontFamily }}
    >
      {/* Background Cyber Glow & Matrix Grid */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 50%, #151b38 0%, ${COLORS.background} 75%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.12,
          backgroundImage: `
            radial-gradient(circle, ${COLORS.secondary} 1px, transparent 1px)
          `,
          backgroundSize: '36px 36px',
        }}
      />

      {/* Main Composition: Transforming Open Weights to Local Workstation AI Core */}
      <AbsoluteFill
        className="flex items-center justify-center p-16"
        style={{ transform: `scale(${coreZoom})`, opacity: enterSpring }}
      >
        <div className="relative w-[850px] h-[850px] flex items-center justify-center">
          {/* Outer Synaptic Particle Rings */}
          <div
            className="absolute inset-0 rounded-full border border-dashed border-white/15"
            style={{ transform: `rotate(${rot3}deg)` }}
          />
          <div
            className="absolute w-[720px] h-[720px] rounded-full border-2 border-dashed"
            style={{
              borderColor: `${COLORS.primary}40`,
              transform: `rotate(${rot2}deg)`,
            }}
          />
          <div
            className="absolute w-[580px] h-[580px] rounded-full border"
            style={{
              borderColor: `${COLORS.secondary}50`,
              transform: `rotate(${rot1}deg)`,
              boxShadow: `0 0 50px ${COLORS.secondary}20`,
            }}
          />

          {/* Glowing Radial Core Backing */}
          <div
            className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none"
            style={{
              backgroundColor: `${COLORS.secondary}30`,
              transform: `scale(${1 + pulseCore * 0.25})`,
            }}
          />

          {/* Central Silicon Neural Engine Die */}
          <div
            className="relative w-80 h-80 rounded-3xl border-2 flex flex-col items-center justify-center p-6 shadow-2xl z-20"
            style={{
              backgroundColor: `${COLORS.surface}F0`,
              borderColor: COLORS.secondary,
              boxShadow: `0 0 80px ${COLORS.secondary}40, inset 0 0 30px ${COLORS.primary}20`,
            }}
          >
            {/* Chip Header */}
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-8 h-8" style={{ color: COLORS.secondary }} />
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-white">
                LOCAL SILICON CORE
              </span>
            </div>

            {/* Glowing Brand Stamp */}
            <div className="text-4xl font-black tracking-tighter uppercase text-white my-1">
              QWEN 3.8
            </div>
            <div
              className="text-sm font-mono font-bold tracking-wider px-3 py-1 rounded-full mb-3"
              style={{ backgroundColor: `${COLORS.secondary}25`, color: COLORS.secondary }}
            >
              27B NEURAL ENGINE
            </div>

            {/* Bus & VRAM Telemetry */}
            <div className="w-full flex items-center justify-between border-t border-white/10 pt-3 text-[11px] font-mono">
              <span className="text-neutral-400">VRAM BUS</span>
              <span className="font-bold text-white">736 GB/s</span>
            </div>
            <div className="w-full flex items-center justify-between text-[11px] font-mono mt-1">
              <span className="text-neutral-400">HARDWARE</span>
              <span style={{ color: COLORS.primary }}>DESKTOP GPU</span>
            </div>
          </div>

          {/* Floating Ingress Data Tensors: Left Side */}
          <div
            className="absolute left-[-240px] flex flex-col gap-4 z-30"
            style={{
              transform: `translateX(${interpolate(tensorProgress, [0, 1], [-80, 0])}px)`,
              opacity: tensorProgress,
            }}
          >
            <div
              className="p-5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl w-72"
              style={{ backgroundColor: `${COLORS.surface}DD` }}
            >
              <div className="flex items-center gap-2 text-xs font-mono" style={{ color: COLORS.primary }}>
                <Layers className="w-4 h-4" />
                <span>OPEN WEIGHTS INGRESS</span>
              </div>
              <div className="text-lg font-bold text-white mt-1 font-mono">
                model-00001-of-00004.safetensors
              </div>
              <div className="text-[11px] font-mono text-neutral-400 mt-2">
                SHARDS: 27,000,000,000 PARAMS
              </div>
            </div>

            <div
              className="p-5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl w-72"
              style={{ backgroundColor: `${COLORS.surface}DD` }}
            >
              <div className="flex items-center gap-2 text-xs font-mono" style={{ color: COLORS.secondary }}>
                <Activity className="w-4 h-4" />
                <span>QUANTIZATION</span>
              </div>
              <div className="text-lg font-bold text-white mt-1 font-mono">
                Q4_K_M / FP8 NATIVE
              </div>
              <div className="text-[11px] font-mono text-neutral-400 mt-2">
                FOOTPRINT: 14.8 GB VRAM
              </div>
            </div>
          </div>

          {/* Floating Local Hardware Status: Right Side */}
          <div
            className="absolute right-[-240px] flex flex-col gap-4 z-30"
            style={{
              transform: `translateX(${interpolate(tensorProgress, [0, 1], [80, 0])}px)`,
              opacity: tensorProgress,
            }}
          >
            <div
              className="p-5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl w-72"
              style={{ backgroundColor: `${COLORS.surface}DD` }}
            >
              <div className="flex items-center gap-2 text-xs font-mono" style={{ color: COLORS.secondary }}>
                <Shield className="w-4 h-4" />
                <span>DATA SOVEREIGNTY</span>
              </div>
              <div className="text-xl font-black text-white mt-1">100% PRIVATE</div>
              <div className="text-[11px] font-mono text-neutral-400 mt-2">
                AIR-GAPPED // ZERO LOGGING
              </div>
            </div>

            <div
              className="p-5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl w-72"
              style={{ backgroundColor: `${COLORS.surface}DD` }}
            >
              <div className="flex items-center gap-2 text-xs font-mono" style={{ color: COLORS.primary }}>
                <Zap className="w-4 h-4" />
                <span>LOCAL EXECUTION</span>
              </div>
              <div className="text-xl font-black text-white mt-1">NATIVE SPEED</div>
              <div className="text-[11px] font-mono text-neutral-400 mt-2">
                ZERO NETWORK OVERHEAD
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* Kinetic Typography HUD */}
      <AbsoluteFill className="pointer-events-none p-16 flex flex-col justify-between z-40">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="px-3 py-1 text-xs font-mono font-bold tracking-widest uppercase rounded"
              style={{ backgroundColor: `${COLORS.secondary}25`, color: COLORS.secondary }}
            >
              PARADIGM SHIFT // PHASE 01
            </span>
          </div>
          <h2 className="text-5xl font-black uppercase tracking-tight text-white m-0">
            Локальное ядро на домашнем ПК
          </h2>
        </div>

        <div className="flex justify-between items-end">
          <div className="text-sm font-mono" style={{ color: COLORS.text, opacity: 0.8 }}>
            TARGET HARDWARE: <span className="text-white font-bold">CONSUMER RTX 3090 / 4090 / 5090</span>
          </div>
          <div className="text-sm font-mono font-bold" style={{ color: COLORS.secondary }}>
            AUTONOMOUS INFERENCE: READY
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ==========================================
// FRAGMENT 7: 3 CORE PILLARS OF SOVEREIGNTY (00:33.18 - 00:39.21)
// ==========================================
const Fragment7ThreePillars: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterSpring = spring({ frame, fps, config: { damping: 200 } });
  const zoom = interpolate(frame, [0, 181], [1.0, 1.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const pillars = [
    {
      num: '01',
      title: 'ПОЛНЫЙ СУВЕРЕНИТЕТ',
      subtitle: 'Абсолютная изоляция данных',
      desc: 'Ни единого байта во внешнюю сеть. Полная безопасность интеллектуальной собственности.',
      icon: Shield,
      accentColor: COLORS.secondary,
      metric: '100% AIR-GAP',
    },
    {
      num: '02',
      title: 'НУЛЕВЫЕ ЗАДЕРЖКИ',
      subtitle: 'Прямая шина памяти',
      desc: 'Отсутствие сетевых очередей, троттлинга провайдеров и зависимости от стабильности интернета.',
      icon: Zap,
      accentColor: COLORS.primary,
      metric: '0ms NETWORK LAG',
    },
    {
      num: '03',
      title: 'ФИКСИРОВАННЫЙ КОСТ',
      subtitle: 'Нулевая стоимость токенов',
      desc: 'Неограниченная генерация кода и аналитики по цене электричества из розетки.',
      icon: TrendingUp,
      accentColor: COLORS.accent,
      metric: '$0.37 / 1M TOKENS',
    },
  ];

  return (
    <AbsoluteFill
      className="overflow-hidden"
      style={{ backgroundColor: COLORS.background, fontFamily: TYPOGRAPHY.fontFamily }}
    >
      {/* Dynamic Diagonal Split Background */}
      <div
        className="absolute inset-0 flex pointer-events-none"
        style={{
          transform: `scale(${zoom}) rotate(-6deg)`,
          opacity: 0.15,
        }}
      >
        <div className="w-1/3 h-[200%] -translate-y-1/4 bg-white/5" />
        <div className="w-1/3 h-[200%] -translate-y-1/4 bg-white/10" />
        <div className="w-1/3 h-[200%] -translate-y-1/4 bg-white/5" />
      </div>

      {/* Atmospheric Glow */}
      <div
        className="absolute w-[1000px] h-[600px] rounded-full blur-[160px] pointer-events-none"
        style={{
          backgroundColor: `${COLORS.primary}15`,
          left: '25%',
          top: '30%',
        }}
      />

      {/* Main Content Layout */}
      <AbsoluteFill className="p-16 flex flex-col justify-between z-20" style={{ opacity: enterSpring }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="px-3 py-1 text-xs font-mono font-bold tracking-widest uppercase rounded"
                style={{ backgroundColor: `${COLORS.primary}25`, color: COLORS.primary }}
              >
                THE NEW ENGINEERING STANDARD
              </span>
              <span className="text-xs font-mono tracking-wider text-neutral-400">
                QWEN 3.8 COMPREHENSIVE GUIDE
              </span>
            </div>
            <h1 className="text-5xl font-black uppercase tracking-tight text-white m-0">
              Три столпа локального искусственного интеллекта
            </h1>
          </div>

          <div className="text-right">
            <div className="text-3xl font-black font-mono text-white">АКТ I</div>
            <div className="text-xs font-mono text-neutral-400">OVERVIEW & HORIZONS</div>
          </div>
        </div>

        {/* 3 Kinetic Feature Columns */}
        <div className="grid grid-cols-3 gap-8 my-auto">
          {pillars.map((pillar, i) => {
            const cardPop = spring({
              frame: frame - i * 8,
              fps,
              config: { damping: 20, stiffness: 160 },
            });
            const Icon = pillar.icon;

            return (
              <div
                key={i}
                className="relative rounded-3xl border border-white/15 p-8 flex flex-col justify-between overflow-hidden shadow-2xl"
                style={{
                  backgroundColor: `${COLORS.surface}DD`,
                  transform: `scale(${cardPop}) translateY(${interpolate(cardPop, [0, 1], [40, 0])}px)`,
                  boxShadow: `0 24px 60px rgba(0,0,0,0.6), inset 0 0 30px ${pillar.accentColor}10`,
                }}
              >
                {/* Decorative Top Pill */}
                <div className="flex items-center justify-between mb-6">
                  <span
                    className="text-4xl font-black font-mono tracking-tighter"
                    style={{ color: pillar.accentColor }}
                  >
                    {pillar.num}
                  </span>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10"
                    style={{ backgroundColor: `${pillar.accentColor}20` }}
                  >
                    <Icon className="w-7 h-7" style={{ color: pillar.accentColor }} />
                  </div>
                </div>

                {/* Body Content */}
                <div>
                  <div
                    className="text-xs font-mono font-bold tracking-widest uppercase mb-1"
                    style={{ color: pillar.accentColor }}
                  >
                    {pillar.subtitle}
                  </div>
                  <h3 className="text-2xl font-black uppercase text-white mb-4 tracking-tight leading-tight">
                    {pillar.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-300 m-0">
                    {pillar.desc}
                  </p>
                </div>

                {/* Bottom Metric Badge */}
                <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-400">BENCHMARK</span>
                  <span
                    className="text-xs font-mono font-black tracking-wider px-3 py-1 rounded-md"
                    style={{
                      backgroundColor: `${pillar.accentColor}25`,
                      color: pillar.accentColor,
                    }}
                  >
                    {pillar.metric}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between border-t border-white/10 pt-6">
          <div className="flex items-center gap-3 text-sm font-mono text-neutral-400">
            <CheckCircle2 className="w-5 h-5" style={{ color: COLORS.secondary }} />
            <span>ФУНДАМЕНТАЛЬНЫЙ РАЗБОР АРХИТЕКТУРЫ И ПРАКТИКИ</span>
          </div>
          <div className="text-sm font-mono tracking-widest uppercase font-bold" style={{ color: COLORS.primary }}>
            СЛЕДУЮЩИЙ РАЗДЕЛ: ГЕОПОЛИТИКА И ЛАБОРАТОРИИ →
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ==========================================
// ROOT SCENE COMPONENT WITH SEQUENCES
// ==========================================
export const Scene: React.FC = () => {
  return (
    <AbsoluteFill className="overflow-hidden" style={{ backgroundColor: COLORS.background }}>
      {/* Фрагмент 1 [B-ROLL]: 0.00с - 5.03с (151 кадр) */}
      <Sequence from={0} durationInFrames={151}>
        <Fragment1Video />
      </Sequence>

      {/* Фрагмент 2 [АНИМАЦИЯ]: 5.03с - 10.05с (151 кадр) */}
      <Sequence from={151} durationInFrames={151}>
        <Fragment2GlobalMap />
      </Sequence>

      {/* Фрагмент 3 [АНИМАЦИЯ]: 10.05с - 15.58с (166 кадров) */}
      <Sequence from={302} durationInFrames={166}>
        <Fragment3ServerMonopoly />
      </Sequence>

      {/* Фрагмент 4 [B-ROLL]: 15.58с - 21.11с (166 кадров) */}
      <Sequence from={468} durationInFrames={166}>
        <Fragment4Video />
      </Sequence>

      {/* Фрагмент 5 [B-ROLL]: 21.11с - 26.64с (166 кадров) */}
      <Sequence from={633} durationInFrames={166}>
        <Fragment5Video />
      </Sequence>

      {/* Фрагмент 6 [АНИМАЦИЯ]: 26.64с - 33.18с (196 кадров) */}
      <Sequence from={799} durationInFrames={196}>
        <Fragment6NeuralCore />
      </Sequence>

      {/* Фрагмент 7 [АНИМАЦИЯ]: 33.18с - 39.21с (182 кадра, до 1177) */}
      <Sequence from={995} durationInFrames={182}>
        <Fragment7ThreePillars />
      </Sequence>

      {/* Layer 3: Cinema Grain & Scanline Overlay */}
      <AbsoluteFill
        className="pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '4px 4px, 100% 3px',
        }}
      />
    </AbsoluteFill>
  );
};

export default Scene;
