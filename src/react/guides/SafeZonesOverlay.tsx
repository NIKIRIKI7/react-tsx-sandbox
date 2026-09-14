import type { CSSProperties } from 'react';

export type SafeZonePreset =
  | 'tiktok-9x16'
  | 'reels-9x16'
  | 'shorts-9x16'
  | 'tv-safe-16x9'
  | 'rule-of-thirds'
  | 'center-cross';

export interface SafeZonesOverlayProps {
  preset?: SafeZonePreset | SafeZonePreset[];
  /** Цвет линий направляющих (rule-of-thirds, TV-safe, center-cross). */
  color?: string;
  /** Цвет линий зон платформ. */
  lineColor?: string;
  /** Заливка зон платформ. */
  fillColor?: string;
  style?: CSSProperties;
  className?: string;
}

interface ZoneGeometry {
  label: string;
  rect: { x: number; y: number; width: number; height: number };
  line: { x1: number; y1: number; x2: number; y2: number };
  fontSize?: number;
}

const TIKTOK_ZONES: ZoneGeometry[] = [
  {
    label: 'TIKTOK: HEADER & SEARCH',
    rect: { x: 0, y: 0, width: 1080, height: 220 },
    line: { x1: 0, y1: 220, x2: 1080, y2: 220 },
    fontSize: 26,
  },
  {
    label: 'TIKTOK: RIGHT ACTIONS',
    rect: { x: 880, y: 520, width: 200, height: 960 },
    line: { x1: 880, y1: 520, x2: 880, y2: 1480 },
    fontSize: 18,
  },
  {
    label: 'TIKTOK: CAPTIONS & NAVIGATION',
    rect: { x: 0, y: 1480, width: 1080, height: 440 },
    line: { x1: 0, y1: 1480, x2: 1080, y2: 1480 },
    fontSize: 28,
  },
];

const REELS_ZONES: ZoneGeometry[] = [
  {
    label: 'REELS: TOP UI',
    rect: { x: 0, y: 0, width: 1080, height: 220 },
    line: { x1: 0, y1: 220, x2: 1080, y2: 220 },
    fontSize: 26,
  },
  {
    label: 'REELS: ACTION RAIL',
    rect: { x: 900, y: 600, width: 180, height: 880 },
    line: { x1: 900, y1: 600, x2: 900, y2: 1480 },
    fontSize: 18,
  },
  {
    label: 'REELS: CAPTIONS',
    rect: { x: 0, y: 1480, width: 1080, height: 440 },
    line: { x1: 0, y1: 1480, x2: 1080, y2: 1480 },
    fontSize: 28,
  },
];

const SHORTS_ZONES: ZoneGeometry[] = [
  {
    label: 'SHORTS: HEADER',
    rect: { x: 0, y: 0, width: 1080, height: 140 },
    line: { x1: 0, y1: 140, x2: 1080, y2: 140 },
    fontSize: 26,
  },
  {
    label: 'SHORTS: ACTIONS',
    rect: { x: 880, y: 620, width: 200, height: 960 },
    line: { x1: 880, y1: 620, x2: 880, y2: 1580 },
    fontSize: 18,
  },
  {
    label: 'SHORTS: TITLE & NAV',
    rect: { x: 0, y: 1580, width: 1080, height: 340 },
    line: { x1: 0, y1: 1580, x2: 1080, y2: 1580 },
    fontSize: 28,
  },
];

const NAV_9x16 = {
  'tiktok-9x16': TIKTOK_ZONES,
  'reels-9x16': REELS_ZONES,
  'shorts-9x16': SHORTS_ZONES,
} as const;

function ZoneGroup({
  zones,
  lineColor,
  fillColor,
}: {
  zones: readonly ZoneGeometry[];
  lineColor: string;
  fillColor: string;
}) {
  return (
    <g fill="none">
      {zones.map((zone, index) => (
        <g key={index}>
          <rect
            x={zone.rect.x}
            y={zone.rect.y}
            width={zone.rect.width}
            height={zone.rect.height}
            fill={fillColor}
          />
          <line
            x1={zone.line.x1}
            y1={zone.line.y1}
            x2={zone.line.x2}
            y2={zone.line.y2}
            stroke={lineColor}
            strokeWidth="2"
          />
          <text
            x={zone.rect.x + 14}
            y={zone.rect.y + (zone.fontSize ?? 24) + 6}
            fontSize={zone.fontSize ?? 22}
            fontWeight="700"
            fill="rgba(255, 255, 255, 0.92)"
            stroke="rgba(0, 0, 0, 0.55)"
            strokeWidth="4"
            paintOrder="stroke"
          >
            {zone.label}
          </text>
        </g>
      ))}
    </g>
  );
}

/**
 * Оверлей безопасных зон и направляющих вертикального формата.
 *
 * Геометрия считается в координатах композиции 1080×1920 (viewBox) и
 * растягивается `preserveAspectRatio="none"`. Атрибут
 * `data-sandbox-overlay="true"` используется снапшотом: оверлей не попадает
 * в экспортированное видео и в кадры плеера.
 */
export function SafeZonesOverlay({
  preset = 'tiktok-9x16',
  color = 'rgba(255, 255, 255, 0.45)',
  lineColor = 'rgba(255, 75, 75, 0.7)',
  fillColor = 'rgba(255, 75, 75, 0.12)',
  style,
  className,
}: SafeZonesOverlayProps) {
  const presets = Array.isArray(preset) ? preset : [preset];

  return (
    <div
      data-testid="safe-zones-overlay"
      data-sandbox-overlay="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden',
        ...style,
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 1080 1920" preserveAspectRatio="none">
        {presets.includes('rule-of-thirds') && (
          <g stroke={color} strokeWidth="1.5" strokeDasharray="10 10">
            <line x1="360" y1="0" x2="360" y2="1920" />
            <line x1="720" y1="0" x2="720" y2="1920" />
            <line x1="0" y1="640" x2="1080" y2="640" />
            <line x1="0" y1="1280" x2="1080" y2="1280" />
          </g>
        )}

        {presets.includes('center-cross') && (
          <g stroke={color} strokeWidth="2">
            <line x1="500" y1="960" x2="580" y2="960" />
            <line x1="540" y1="940" x2="540" y2="980" />
          </g>
        )}

        {presets.includes('tv-safe-16x9') && (
          <g fill="none" stroke={color} strokeWidth="2">
            <rect x="54" y="96" width="972" height="1728" strokeDasharray="12 8" />
            <rect x="108" y="192" width="864" height="1536" />
          </g>
        )}

        {presets
          .filter((presetName): presetName is keyof typeof NAV_9x16 => presetName in NAV_9x16)
          .map((presetName) => (
            <ZoneGroup
              key={presetName}
              zones={NAV_9x16[presetName]}
              lineColor={lineColor}
              fillColor={fillColor}
            />
          ))}
      </svg>
    </div>
  );
}