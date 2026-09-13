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
  color?: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * Оверлей безопасных зон и направляющих (TikTok/Reels/Shorts, TV-safe,
 * правило третей, центральное перекрестье).
 */
export function SafeZonesOverlay({
  preset = 'tiktok-9x16',
  color = 'rgba(255, 255, 255, 0.45)',
  style,
  className,
}: SafeZonesOverlayProps) {
  const presets = Array.isArray(preset) ? preset : [preset];

  return (
    <div
      data-testid="safe-zones-overlay"
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
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {presets.includes('rule-of-thirds') && (
          <g stroke={color} strokeWidth="0.4" strokeDasharray="1.5 1.5">
            <line x1="33.33" y1="0" x2="33.33" y2="100" />
            <line x1="66.66" y1="0" x2="66.66" y2="100" />
            <line x1="0" y1="33.33" x2="100" y2="33.33" />
            <line x1="0" y1="66.66" x2="100" y2="66.66" />
          </g>
        )}

        {presets.includes('center-cross') && (
          <g stroke={color} strokeWidth="0.4">
            <line x1="50" y1="46" x2="50" y2="54" />
            <line x1="46" y1="50" x2="54" y2="50" />
          </g>
        )}

        {presets.includes('tv-safe-16x9') && (
          <g fill="none" stroke={color} strokeWidth="0.5">
            <rect x="5" y="5" width="90" height="90" strokeDasharray="2 1" />
            <rect x="10" y="10" width="80" height="80" />
          </g>
        )}

        {(presets.includes('tiktok-9x16') ||
          presets.includes('reels-9x16') ||
          presets.includes('shorts-9x16')) && (
          <g fill="none">
            <rect x="0" y="0" width="100" height="12" fill="rgba(255, 75, 75, 0.12)" />
            <line x1="0" y1="12" x2="100" y2="12" stroke="rgba(255, 75, 75, 0.7)" strokeWidth="0.4" />

            <rect x="84" y="38" width="16" height="42" fill="rgba(255, 75, 75, 0.12)" />
            <line x1="84" y1="38" x2="84" y2="80" stroke="rgba(255, 75, 75, 0.7)" strokeWidth="0.4" />

            <rect x="0" y="78" width="100" height="22" fill="rgba(255, 75, 75, 0.12)" />
            <line x1="0" y1="78" x2="100" y2="78" stroke="rgba(255, 75, 75, 0.7)" strokeWidth="0.4" />
          </g>
        )}
      </svg>
    </div>
  );
}
