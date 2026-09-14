import { PipelinePlugin } from '../core/types';

/**
 * Scoped Tailwind JIT для кода песочницы.
 *
 * Плагин сканирует исходник на классы `className`, генерирует для них CSS
 * на лету (JIT — только использованные утилиты) и оборачивает компонент
 * в `<div className={scope}>` с собственным `<style>`. Селекторы префиксуются
 * классом области, поэтому стили песочницы не «протекают» в приложение-хост.
 *
 * Каталог покрывает распространённые утилиты Tailwind v3; при необходимости
 * можно подставить свой генератор через опцию `builder`.
 */

export const TAILWIND_SCOPE = '__tsx_tw';

export interface TailwindJitPluginOptions {
  /** Имя плагина. По умолчанию `tailwind-jit`. */
  name?: string;
  /** Класс-область для scoping. По умолчанию `__tsx_tw`. */
  scope?: string;
  /** Кастомный генератор CSS: (classes, scopeClass) => css. */
  builder?: (classes: string[], scopeClass: string) => string;
}

// ---- Каталог цветов Tailwind v3 ------------------------------------------

type ShadeMap = Record<string, string>;

const SHADES: Record<string, ShadeMap> = {
  slate: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
  gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712' },
  zinc: { 50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8', 400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b' },
  neutral: { 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a3a3a3', 500: '#737373', 600: '#525252', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0a0a0a' },
  stone: { 50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917', 950: '#0c0a09' },
  red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a' },
  orange: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407' },
  amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03' },
  yellow: { 50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12', 950: '#422006' },
  lime: { 50: '#f7fee7', 100: '#ecfccb', 200: '#d9f99d', 300: '#bef264', 400: '#a3e635', 500: '#84cc16', 600: '#65a30d', 700: '#4d7c0f', 800: '#3f6212', 900: '#365314', 950: '#1a2e05' },
  green: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16' },
  emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22' },
  teal: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e' },
  cyan: { 50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63', 950: '#083344' },
  sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
  indigo: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b' },
  violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065' },
  purple: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87', 950: '#3b0764' },
  fuchsia: { 50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e' },
  pink: { 50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843', 950: '#500724' },
  rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519' },
};

const NAMED_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  current: 'currentColor',
};

/** Извлекает цвет из токена вида `red-500` / `white` / `red-500/10`. */
function resolveColorToken(token: string): string | null {
  let colorPart = token;
  let alpha: number | null = null;

  const slash = token.lastIndexOf('/');
  if (slash !== -1) {
    colorPart = token.slice(0, slash);
    const alphaValue = Number(token.slice(slash + 1));
    if (!Number.isNaN(alphaValue) && alphaValue >= 0 && alphaValue <= 100) {
      alpha = alphaValue / 100;
    }
  }

  if (NAMED_COLORS[colorPart] !== undefined) {
    const base = NAMED_COLORS[colorPart];
    if (alpha === null || base === 'transparent' || base === 'currentColor') return base;
    return rgba(base, alpha);
  }

  const dash = colorPart.lastIndexOf('-');
  if (dash === -1) return null;
  const hue = colorPart.slice(0, dash);
  const shadeKey = colorPart.slice(dash + 1);
  const hex = SHADES[hue]?.[shadeKey];
  if (!hex) return null;
  return alpha === null ? hex : rgba(hex, alpha);
}

function rgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---- Числовые шкалы -------------------------------------------------------

const SPACING: Record<string, string> = {
  '0': '0', '0.5': '0.125rem', '1': '0.25rem', '1.5': '0.375rem', '2': '0.5rem',
  '2.5': '0.625rem', '3': '0.75rem', '3.5': '0.875rem', '4': '1rem', '5': '1.25rem',
  '6': '1.5rem', '7': '1.75rem', '8': '2rem', '9': '2.25rem', '10': '2.5rem',
  '11': '2.75rem', '12': '3rem', '14': '3.5rem', '16': '4rem', '20': '5rem',
  '24': '6rem', '28': '7rem', '32': '8rem', '36': '9rem', '40': '10rem', '44': '11rem',
  '48': '12rem', '52': '13rem', '56': '14rem', '60': '15rem', '64': '16rem',
  '72': '18rem', '80': '20rem', '96': '24rem', 'px': '1px',
};

const FRACTIONS: Record<string, string> = {
  '1/2': '50%', '1/3': '33.333333%', '2/3': '66.666667%', '1/4': '25%', '3/4': '75%',
  '1/5': '20%', '2/5': '40%', '3/5': '60%', '4/5': '80%', '1/6': '16.666667%',
  '5/6': '83.333333%', '1/12': '8.333333%', '5/12': '41.666667%', '7/12': '58.333333%',
  '11/12': '91.666667%',
};

function spacingValue(token: string): string | null {
  return SPACING[token] ?? null;
}

function sizeValue(token: string): string | null {
  if (FRACTIONS[token]) return FRACTIONS[token];
  if (token === 'full') return '100%';
  if (token === 'screen') return null; // заменяется в рамках w/h
  if (token === 'auto') return 'auto';
  return SPACING[token] ?? null;
}

const FONT_SIZES: Record<string, [string, string]> = {
  xs: ['0.75rem', '1rem'], sm: ['0.875rem', '1.25rem'], base: ['1rem', '1.5rem'],
  lg: ['1.125rem', '1.75rem'], xl: ['1.25rem', '1.75rem'], '2xl': ['1.5rem', '2rem'],
  '3xl': ['1.875rem', '2.25rem'], '4xl': ['2.25rem', '2.5rem'], '5xl': ['3rem', '1'],
  '6xl': ['3.75rem', '1'], '7xl': ['4.5rem', '1'], '8xl': ['6rem', '1'], '9xl': ['8rem', '1'],
};

const FONT_WEIGHTS: Record<string, string> = {
  thin: '100', extralight: '200', light: '300', normal: '400', medium: '500',
  semibold: '600', bold: '700', extrabold: '800', black: '900',
};

const FONT_FAMILIES: Record<string, string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "ui-serif, Georgia, serif",
  mono: "ui-monospace, SFMono-Regular, Consolas, monospace",
};

const TEXT_ALIGN: Record<string, string> = {
  'text-left': 'left', 'text-center': 'center', 'text-right': 'right', 'text-justify': 'justify',
};

const TRACKING: Record<string, string> = {
  tighter: '-0.05em', tight: '-0.025em', normal: '0', wide: '0.025em', wider: '0.05em', widest: '0.1em',
};

const LEADING: Record<string, string> = {
  none: '1', tight: '1.25', snug: '1.375', normal: '1.5', relaxed: '1.625', loose: '2',
};

const SHADOW: Record<string, string> = {
  'shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
};

const BLUR: Record<string, string> = {
  blur: '8px', 'blur-sm': '4px', 'blur-md': '12px', 'blur-lg': '16px',
  'blur-xl': '24px', 'blur-2xl': '40px', 'blur-3xl': '64px',
};

/** Возвращает CSS-правила (`property:value`) для класса или null. */
function ruleFor(token: string): string | null {
  if (token.indexOf('[') !== -1 || token.includes('${')) return null;
  if (token.includes(':') || token.startsWith('-')) return null;

  // display
  const display: Record<string, string> = {
    block: 'block', 'inline-block': 'inline-block', inline: 'inline',
    flex: 'flex', 'inline-flex': 'inline-flex', grid: 'grid', 'inline-grid': 'inline-grid',
    hidden: 'none',
  };
  if (display[token]) return `display:${display[token]}`;

  // position
  const position: Record<string, string> = { static: 'static', relative: 'relative', absolute: 'absolute', fixed: 'fixed', sticky: 'sticky' };
  if (position[token]) return `position:${position[token]}`;

  // flex layout
  if (token === 'flex-row') return 'flex-direction:row';
  if (token === 'flex-col') return 'flex-direction:column';
  if (token === 'flex-row-reverse') return 'flex-direction:row-reverse';
  if (token === 'flex-col-reverse') return 'flex-direction:column-reverse';
  if (token === 'flex-wrap') return 'flex-wrap:wrap';
  if (token === 'flex-nowrap') return 'flex-wrap:nowrap';
  if (token === 'flex-1') return 'flex:1 1 0%';
  if (token === 'flex-auto') return 'flex:1 1 auto';
  if (token === 'flex-initial') return 'flex:0 1 auto';
  if (token === 'flex-none') return 'flex:none';
  if (token === 'grow' || token === 'flex-grow') return 'flex-grow:1';
  if (token === 'grow-0') return 'flex-grow:0';
  if (token === 'shrink') return 'flex-shrink:1';
  if (token === 'shrink-0') return 'flex-shrink:0';

  const alignMap: Record<string, string> = {
    'items-start': 'align-items:flex-start', 'items-end': 'align-items:flex-end',
    'items-center': 'align-items:center', 'items-baseline': 'align-items:baseline',
    'items-stretch': 'align-items:stretch',
    'justify-start': 'justify-content:flex-start', 'justify-end': 'justify-content:flex-end',
    'justify-center': 'justify-content:center', 'justify-between': 'justify-content:space-between',
    'justify-around': 'justify-content:space-around', 'justify-evenly': 'justify-content:space-evenly',
    'self-start': 'align-self:flex-start', 'self-end': 'align-self:flex-end',
    'self-center': 'align-self:center', 'self-stretch': 'align-self:stretch',
    'content-center': 'align-content:center', 'content-between': 'align-content:space-between',
    'content-around': 'align-content:space-around',
  };
  if (alignMap[token]) return alignMap[token];

  // overflow / cursor / whitespace
  const overflowMap: Record<string, string> = {
    'overflow-hidden': 'hidden', 'overflow-auto': 'auto', 'overflow-scroll': 'scroll',
    'overflow-visible': 'visible', 'overflow-clip': 'clip', 'overflow-x-hidden': 'x-hide',
  };
  if (token === 'overflow-hidden' || token === 'overflow-auto' || token === 'overflow-scroll' || token === 'overflow-visible' || token === 'overflow-clip') {
    return `overflow:${overflowMap[token]}`;
  }
  if (token === 'overflow-x-hidden') return 'overflow-x:hidden';
  if (token === 'overflow-y-hidden') return 'overflow-y:hidden';
  if (token === 'whitespace-nowrap') return 'white-space:nowrap';
  if (token === 'whitespace-pre') return 'white-space:pre';
  if (token === 'whitespace-pre-wrap') return 'white-space:pre-wrap';
  if (token === 'whitespace-normal') return 'white-space:normal';
  if (token === 'truncate') return 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  if (token === 'cursor-pointer') return 'cursor:pointer';
  if (token === 'cursor-default') return 'cursor:default';
  if (token === 'cursor-not-allowed') return 'cursor:not-allowed';
  if (token === 'pointer-events-none') return 'pointer-events:none';
  if (token === 'pointer-events-auto') return 'pointer-events:auto';
  if (token === 'select-none') return 'user-select:none';

  // z-index
  const zMatch = /^z-(\d+)$/.exec(token);
  if (zMatch) return `z-index:${zMatch[1]}`;

  // inset (t/r/b/l/inset)
  if (token === 'inset-0') return 'top:0;right:0;bottom:0;left:0';
  const insetMatch = /^(top|right|bottom|left|inset)-(.+)$/.exec(token);
  if (insetMatch) {
    const size = spacingValue(insetMatch[2]);
    if (size !== null) {
      const prop = insetMatch[1] === 'inset' ? 'inset' : insetMatch[1];
      return `${prop}:${size}`;
    }
  }

  // spacing: p/m/gap
  const spaceMatch = /^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y)-(.+)$/.exec(token);
  if (spaceMatch) {
    const size = spacingValue(spaceMatch[2]);
    if (size !== null) {
      const map: Record<string, string> = {
        p: 'padding', px: 'padding-left;padding-right', py: 'padding-top;padding-bottom',
        pt: 'padding-top', pr: 'padding-right', pb: 'padding-bottom', pl: 'padding-left',
        m: 'margin', mx: 'margin-left;margin-right', my: 'margin-top;margin-bottom',
        mt: 'margin-top', mr: 'margin-right', mb: 'margin-bottom', ml: 'margin-left',
        gap: 'gap', 'gap-x': 'column-gap', 'gap-y': 'row-gap',
      };
      const prop = map[spaceMatch[1]];
      return prop.split(';').map((p) => `${p}:${size}`).join(';');
    }
  }

  // size w/h/min/max
  const sizeMatch = /^(w|h|min-w|min-h|max-w|max-h)-(.+)$/.exec(token);
  if (sizeMatch) {
    const kind = sizeMatch[1];
    const valueToken = sizeMatch[2];
    if (valueToken === 'screen') {
      const axis = kind === 'w' || kind === 'min-w' || kind === 'max-w' ? 'width' : 'height';
      return `${axis}:100vw`;
    }
    const size = sizeValue(valueToken);
    if (size !== null) {
      const axis = kind === 'w' || kind === 'min-w' || kind === 'max-w' ? 'width' : 'height';
      return `${kind === 'w' || kind === 'h' ? axis : kind}:${size}`;
    }
  }

  // rounded / radius
  if (token === 'rounded') return 'border-radius:0.25rem';
  if (token === 'rounded-full') return 'border-radius:9999px';
  if (token === 'rounded-none') return 'border-radius:0';
  const roundedMatch = /^rounded-(sm|md|lg|xl|2xl|3xl)$/.exec(token);
  if (roundedMatch) {
    const sizes: Record<string, string> = { sm: '0.125rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem' };
    return `border-radius:${sizes[roundedMatch[1]]}`;
  }

  // border
  if (token === 'border') return 'border-width:1px;border-style:solid';
  const borderWidthMatch = /^border-([0248])$/.exec(token);
  if (borderWidthMatch) return `border-width:${borderWidthMatch[1]}px;border-style:solid`;
  if (token === 'border-solid') return 'border-style:solid';
  if (token === 'border-dashed') return 'border-style:dashed';
  if (token === 'border-none') return 'border-style:none';
  const borderColorMatch = /^border-(.+)$/.exec(token);
  if (borderColorMatch) {
    const color = resolveColorToken(borderColorMatch[1]);
    if (color !== null) return `border-color:${color}`;
  }

  // цвета
  const colorPrefixes: Array<[RegExp, (color: string) => string]> = [
    [/^bg-(.+)$/, (color) => `background-color:${color}`],
    [/^text-(.+)$/, (color) => `color:${color}`],
    [/^ring-(.+)$/, (color) => `box-shadow:0 0 0 3px ${color}`],
  ];
  for (const [regex, map] of colorPrefixes) {
    const match = regex.exec(token);
    if (!match) continue;
    const color = resolveColorToken(match[1]);
    if (color !== null) return map(color);
  }

  // font-size (text-* размеры) — после обработки цветов, чтобы `text-red-500` не попал сюда
  if (TEXT_ALIGN[token]) return `text-align:${TEXT_ALIGN[token]}`;
  const fontMatch = /^text-(.+)$/.exec(token);
  if (fontMatch) {
    const size = FONT_SIZES[fontMatch[1]];
    if (size) return `font-size:${size[0]};line-height:${size[1]}`;
  }

  // font weight / family
  if (FONT_WEIGHTS[token.startsWith('font-') ? token.slice(5) : token] !== undefined) {
    return `font-weight:${FONT_WEIGHTS[token.slice(5)]}`;
  }
  if (FONT_FAMILIES[token.slice(5)] !== undefined) return `font-family:${FONT_FAMILIES[token.slice(5)]}`;

  // tracking / leading
  const trackingMatch = /^tracking-(.+)$/.exec(token);
  if (trackingMatch && TRACKING[trackingMatch[1]] !== undefined) return `letter-spacing:${TRACKING[trackingMatch[1]]}`;
  const leadingMatch = /^leading-(.+)$/.exec(token);
  if (leadingMatch && LEADING[leadingMatch[1]] !== undefined) return `line-height:${LEADING[leadingMatch[1]]}`;

  // text case
  if (token === 'uppercase') return 'text-transform:uppercase';
  if (token === 'lowercase') return 'text-transform:lowercase';
  if (token === 'capitalize') return 'text-transform:capitalize';
  if (token === 'normal-case') return 'text-transform:none';
  if (token === 'italic') return 'font-style:italic';
  if (token === 'not-italic') return 'font-style:normal';
  if (token === 'underline') return 'text-decoration-line:underline';
  if (token === 'line-through') return 'text-decoration-line:line-through';
  if (token === 'no-underline') return 'text-decoration-line:none';
  if (token === 'tabular-nums') return 'font-variant-numeric:tabular-nums';

  // opacity
  const opacityMatch = /^opacity-(\d{1,3})$/.exec(token);
  if (opacityMatch) return `opacity:${Number(opacityMatch[1]) / 100}`;

  // shadows
  if (SHADOW[token] !== undefined) return `box-shadow:${SHADOW[token]}`;

  // blur
  if (BLUR[token] !== undefined) return `filter:blur(${BLUR[token]})`;

  // animations
  if (token === 'animate-pulse') return 'animation:tsx-tw-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite';
  if (token === 'animate-bounce') return 'animation:tsx-tw-bounce 1s infinite';
  if (token === 'animate-spin') return 'animation:tsx-tw-spin 1s linear infinite';
  if (token === 'animate-ping') return 'animation:tsx-tw-ping 1s cubic-bezier(0,0,0.2,1) infinite';

  // transition
  if (token === 'transition') return 'transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-timing-function:cubic-bezier(0.4,0,0.2,1);transition-duration:150ms';
  if (token === 'transition-all') return 'transition-property:all;transition-timing-function:cubic-bezier(0.4,0,0.2,1);transition-duration:150ms';
  if (token === 'transition-colors') return 'transition-property:color,background-color,border-color,text-decoration-color,fill,stroke;transition-timing-function:cubic-bezier(0.4,0,0.2,1);transition-duration:150ms';
  if (token === 'transition-transform') return 'transition-property:transform;transition-timing-function:cubic-bezier(0.4,0,0.2,1);transition-duration:150ms';

  // grid cols
  const gridMatch = /^grid-cols-(\d+)$/.exec(token);
  if (gridMatch) return `grid-template-columns:repeat(${gridMatch[1]}, minmax(0, 1fr))`;

  return null;
}

const KEYFRAMES = `
@keyframes tsx-tw-pulse { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
@keyframes tsx-tw-bounce { 0%,100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8,0,1,1) } 50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1) } }
@keyframes tsx-tw-spin { to { transform: rotate(360deg) } }
@keyframes tsx-tw-ping { 75%,100% { transform: scale(2); opacity: 0 } }
`;

/** Собирает все токены `className` (литералы и простые шаблоны без интерполяции). */
export function collectTailwindClasses(code: string): string[] {
  const classes = new Set<string>();
  const attrRe = /className\s*=\s*({)?\s*(["'`])/g;

  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(code)) !== null) {
    const quote = match[2];
    const start = match.index + match[0].length - 1;
    const endQuote = code.indexOf(quote, start + 1);
    if (endQuote === -1) continue;

    const raw = code.slice(start + 1, endQuote);
    if (raw.includes('${')) continue;

    for (const token of raw.split(/\s+/)) {
      if (!token) continue;
      if (!/^[\w/:.%.-]+$/.test(token)) continue;
      classes.add(token);
    }
    attrRe.lastIndex = endQuote + 1;
  }

  const plainRe = /\bclass\s*=\s*"([^"]+)"/g;
  while ((match = plainRe.exec(code)) !== null) {
    for (const token of match[1].split(/\s+/)) {
      if (!token) continue;
      if (ruleFor(token) === null) continue;
      classes.add(token);
    }
  }

  return Array.from(classes).sort();
}

/** Генерирует scoped CSS для списка классов. */
export function scopedTailwindCss(scopeClass: string, classes: string[]): string {
  const seen = new Set<string>();
  let css = '';

  for (const token of classes) {
    const rule = ruleFor(token);
    if (rule === null || seen.has(token)) continue;
    seen.add(token);
    css += `\n.${scopeClass} .${token}{${rule}}`;
  }

  return KEYFRAMES + css;
}

/**
 * Создаёт плагин конвейера для scoped Tailwind JIT.
 *
 * Каждый файл оборачивается в `<div className={scope}>` со своим `<style>`,
 * поэтому классы песочницы не влияют на UI хоста.
 */
export function createTailwindJitPlugin(options: TailwindJitPluginOptions = {}): PipelinePlugin {
  const scope = options.scope ?? TAILWIND_SCOPE;
  const collected = new Map<string, string[]>();

  return {
    name: options.name ?? 'tailwind-jit',

    beforeCompile(code: string, filepath: string): string {
      collected.set(filepath, collectTailwindClasses(code));
      return code;
    },

    afterCompile(compiledJs: string, filepath: string): string {
      const classes = collected.get(filepath) ?? [];
      // Scope CSS тем же классом, что и обёртка: селекторы `.scopeClass .cls`
      // реально матчат DOM (иначе утилиты применялись бы только к div-обёртке).
      const scopeClass = `${scope}-${Math.abs(hashCode(filepath)).toString(36)}`;
      const css = options.builder
        ? options.builder(classes, scopeClass)
        : scopedTailwindCss(scopeClass, classes);

      const jsonCss = JSON.stringify(css);
      const wrapper = `
;(function () {
  var Original = exports.default;
  if (!Original && typeof exports !== 'undefined') {
    for (var k in exports) {
      if (k !== 'default' && k !== '__esModule' && typeof exports[k] === 'function') {
        Original = exports[k];
        break;
      }
    }
  }
  if (!Original || typeof Original !== 'function') return;
  var scopeCls = ${JSON.stringify(scopeClass)};
  var injectedCss = ${jsonCss};
  function TailwindJitWrapper(props) {
    return React.createElement('div', { className: scopeCls },
      React.createElement('style', { dangerouslySetInnerHTML: { __html: injectedCss } }),
      React.createElement(Original, props)
    );
  }
  TailwindJitWrapper.displayName = 'TailwindJit(${filepath.replace(/[^\w]/g, '_')})';
  exports.default = TailwindJitWrapper;
})();
`;
      return compiledJs + wrapper;
    },
  };
}

function hashCode(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}