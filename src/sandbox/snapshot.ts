import { logger } from '../core/logger';

export interface SnapshotOptions {
  /** MIME-тип изображения. По умолчанию `image/png`. */
  format?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** Качество для jpeg/webp (0..1). По умолчанию 0.95. */
  quality?: number;
  /** Целевой размер кадра (1:1, без UI-масштаба). */
  targetWidth?: number;
  targetHeight?: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const OVERLAY_SELECTORS =
  '[data-sandbox-overlay], [data-testid="safe-zones-overlay"], .safe-zone-overlay, audio, video';

/**
 * Находит элемент композиции: размеченный `[data-remotion-canvas="true"]`
 * или первый кандидат с инлайновыми `width`/`height` (например, блок
 * `__remotion-player`). Оверлеи и UI-панели остаются «снаружи».
 */
export function findCompositionElement(container: HTMLElement): HTMLElement | null {
  const marked = container.querySelector<HTMLElement>('[data-remotion-canvas="true"]');
  if (marked) return marked;

  return (
    Array.from(container.querySelectorAll<HTMLElement>('[style*="width:"][style*="height:"]')).find(
      (element) => element.clientWidth > 0 || element.offsetWidth > 0,
    ) ?? null
  );
}

/** Вырезает из кадра оверлеи и медиа (не относятся к контенту). */
export function stripSandboxElements(root: HTMLElement): void {
  root.querySelectorAll(OVERLAY_SELECTORS).forEach((element) => element.remove());
}

function normalizeCloneStyles(clone: HTMLElement, width: number, height: number): void {
  clone.style.cssText = [
    'position: relative',
    'top: 0',
    'left: 0',
    'margin: 0',
    `width: ${width}px`,
    `height: ${height}px`,
    'min-width: 0',
    'min-height: 0',
    'max-width: none',
    'max-height: none',
    'overflow: hidden',
    'box-sizing: border-box',
  ].join(';');
}

/**
 * Копирует пиксели ОРИГИНАЛЬНЫХ canvas в клоны (внутри foreignObject
 * холсты сериализуются пустыми). Best-effort; если canvas tainted — пропускаем.
 */
function inheritCanvasPixels(sourceContainer: HTMLElement, clone: HTMLElement): void {
  const sources = Array.from(sourceContainer.querySelectorAll('canvas'));
  clone.querySelectorAll('canvas').forEach((target) => {
    const source = sources.shift();
    if (!source) return;
    if (!(source instanceof HTMLCanvasElement) || !(target instanceof HTMLCanvasElement)) return;
    try {
      target.width = source.width;
      target.height = source.height;
      const context = target.getContext('2d');
      if (context) {
        context.drawImage(source, 0, 0);
      }
    } catch (error) {
      logger.warn('Не удалось скопировать пиксели canvas в кадр', error);
    }
  });
}

function collectPageCss(): string {
  let css = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules ?? []);
        for (const rule of rules) {
          css += `${rule.cssText}\n`;
        }
      } catch (error) {
        logger.warn('Не удалось прочитать стили таблицы', error);
      }
    }
  } catch (error) {
    logger.warn('Не удалось собрать стили страницы', error);
  }
  return css;
}

/**
 * Сериализует изолированную композицию в `data:image/svg+xml`:
 *  - клонируется ТОЛЬКО `[data-remotion-canvas]` (без оверлеев Safe Zones);
 *  - стили страницы инжектируются в `<style>` (классы вроде Tailwind работают);
 *  - пиксели canvas переносятся из оригинала.
 */
export function buildCompositionSvgDataUrl(
  container: HTMLElement,
  width: number,
  height: number,
): string {
  const compositionElement = findCompositionElement(container);
  const clone = (compositionElement ?? container).cloneNode(true) as HTMLElement;

  stripSandboxElements(clone);
  normalizeCloneStyles(clone, width, height);
  inheritCanvasPixels(container, clone);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const css = collectPageCss();
  if (css) {
    const style = document.createElementNS(SVG_NS, 'style');
    style.textContent = css;
    svg.appendChild(style);
  }

  const foreignObject = document.createElementNS(SVG_NS, 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');

  const content = document.createElementNS(XHTML_NS, 'div');
  content.setAttribute('xmlns', XHTML_NS);
  content.style.cssText = `width:${width}px;height:${height}px;overflow:hidden;`;
  content.appendChild(clone);

  foreignObject.appendChild(content);
  svg.appendChild(foreignObject);

  const xml = new XMLSerializer().serializeToString(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

function safeRevokeObjectUrl(url: string): void {
  if (typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function rasterize(
  dataUrl: string,
  width: number,
  height: number,
  format: Exclude<SnapshotOptions['format'], undefined>,
  quality: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Растеризация недоступна в этой среде.'));
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Не удалось инициализировать 2D-контекст canvas.'));
      return;
    }

    const image = new Image();
    image.onload = () => {
      try {
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL(format, quality));
      } catch (error) {
        reject(error as Error);
      } finally {
        safeRevokeObjectUrl(dataUrl);
      }
    };
    image.onerror = () => {
      safeRevokeObjectUrl(dataUrl);
      reject(new Error('Не удалось растеризовать кадр в canvas.'));
    };
    image.src = dataUrl;
  });
}

/**
 * Снимает текущий кадр композиции в data-URL прямо в браузере (Zero-Backend).
 *
 * Порядок: готовый `<canvas>` с пропорциями таргета → изоляция
 * `[data-remotion-canvas]` → SVG `<foreignObject>` → canvas → SVG data-URL
 * (best-effort, если растеризация недоступна).
 */
export async function takeContainerSnapshot(
  container: HTMLElement | null,
  options: SnapshotOptions = {},
): Promise<string> {
  if (!container) {
    throw new TypeError('Container must be an HTMLElement');
  }

  const format = options.format ?? 'image/png';
  const quality = options.quality ?? 0.95;

  const canvases = Array.from(container.querySelectorAll('canvas'));
  if (canvases.length > 0) {
    const targetWidth = options.targetWidth ?? 0;
    const targetHeight = options.targetHeight ?? 0;
    const aspectMatch = canvases.find((canvas) => {
      if (canvas.width <= 0 || canvas.height <= 0) return false;
      if (targetWidth > 0 && targetHeight > 0) {
        return Math.abs(canvas.width / canvas.height - targetWidth / targetHeight) <= 0.15;
      }
      return true;
    });
    const direct = aspectMatch ?? canvases[0];
    if (direct) {
      try {
        return direct.toDataURL(format, quality);
      } catch (error) {
        logger.warn('Canvas tainted, пробуем DOM-растеризацию', error);
      }
    }
  }

  const compositionElement = findCompositionElement(container);
  const width =
    options.targetWidth ||
    compositionElement?.offsetWidth ||
    container.offsetWidth ||
    1920;
  const height =
    options.targetHeight ||
    compositionElement?.offsetHeight ||
    container.offsetHeight ||
    1080;

  const dataUrl = buildCompositionSvgDataUrl(container, width, height);

  try {
    return await rasterize(dataUrl, width, height, format, quality);
  } catch (error) {
    logger.warn('SVG-растеризация кадра не удалась, возвращаем SVG data URL', error);
    return dataUrl;
  }
}