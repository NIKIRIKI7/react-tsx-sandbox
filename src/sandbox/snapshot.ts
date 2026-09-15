import { logger } from '../core/logger';

export interface SnapshotOptions {
  format?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  targetWidth?: number;
  targetHeight?: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const OVERLAY_SELECTORS =
  '[data-sandbox-overlay], [data-testid="safe-zones-overlay"], .safe-zone-overlay';

export function findCompositionElement(container: HTMLElement): HTMLElement | null {
  const marked = container.querySelector<HTMLElement>('[data-remotion-canvas="true"]');
  if (marked) return marked;

  return (
    Array.from(container.querySelectorAll<HTMLElement>('[style*="width:"][style*="height:"]')).find(
      (element) => element.clientWidth > 0 || element.offsetWidth > 0,
    ) ?? null
  );
}

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
    'background-color: #000000', // Исключает прозрачность подложки (устраняет H.264 артефакты)
  ].join(';');
}

function inheritCanvasPixels(sourceContainer: HTMLElement, clone: HTMLElement): void {
  const sources = Array.from(sourceContainer.querySelectorAll('canvas'));
  clone.querySelectorAll('canvas').forEach((target) => {
    const source = sources.shift();
    if (!source || !(source instanceof HTMLCanvasElement) || !(target instanceof HTMLCanvasElement)) return;
    try {
      const img = document.createElement('img');
      img.src = source.toDataURL('image/png', 1.0);
      img.className = target.className;
      img.style.cssText = target.style.cssText;
      if (!img.style.width) img.style.width = source.offsetWidth + 'px';
      if (!img.style.height) img.style.height = source.offsetHeight + 'px';
      target.replaceWith(img);
    } catch (error) {
      logger.warn('Не удалось скопировать пиксели canvas в кадр (возможно CORS taint)', error);
    }
  });
}

function inheritVideoPixels(sourceContainer: HTMLElement, clone: HTMLElement): void {
  const sourceVideos = Array.from(sourceContainer.querySelectorAll('video'));
  clone.querySelectorAll('video').forEach((target) => {
    const source = sourceVideos.shift();
    if (!source || !(source instanceof HTMLVideoElement)) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = source.videoWidth || source.clientWidth || target.clientWidth || 1920;
      canvas.height = source.videoHeight || source.clientHeight || target.clientHeight || 1080;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
      }
      canvas.className = target.className;
      canvas.style.cssText = target.style.cssText;

      const img = document.createElement('img');
      // Используем JPEG для видеокадров, так как прозрачность видео в вебе всё равно почти не встречается,
      // а JPEG быстрее кодируется и весит кратно меньше в DOM.
      img.src = canvas.toDataURL('image/jpeg', 1.0);
      img.className = target.className;
      img.style.cssText = target.style.cssText;
      if (!img.style.width) img.style.width = source.offsetWidth + 'px';
      if (!img.style.height) img.style.height = source.offsetHeight + 'px';
      img.style.objectFit = window.getComputedStyle(source).objectFit || 'cover';
      target.replaceWith(img);
    } catch (error) {
      logger.warn('Не удалось скопировать кадр видео в canvas', error);
    }
  });
}

function inheritImagePixels(sourceContainer: HTMLElement, clone: HTMLElement): void {
  const sourceImages = Array.from(sourceContainer.querySelectorAll('img'));
  clone.querySelectorAll('img').forEach((target) => {
    const source = sourceImages.shift();
    if (!source || !(source instanceof HTMLImageElement)) return;
    if (target.src.startsWith('data:')) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = source.naturalWidth || source.width || target.clientWidth || 1920;
      canvas.height = source.naturalHeight || source.height || target.clientHeight || 1080;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        target.src = canvas.toDataURL('image/png', 1.0);
      }
    } catch (error) {
      // Ignore CORS errors
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
  inheritVideoPixels(container, clone);
  inheritImagePixels(container, clone);

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
  content.style.cssText = `width:${width}px;height:${height}px;overflow:hidden;background-color:#000000;`;
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
    // willReadFrequently может слегка ускорить toDataURL в некоторых браузерах
    const context = canvas.getContext('2d', { willReadFrequently: true, alpha: false });

    if (!context) {
      reject(new Error('Не удалось инициализировать 2D-контекст canvas.'));
      return;
    }

    const image = new Image();
    image.onload = () => {
      try {
        // Жесткая черная подложка
        context.fillStyle = '#000000';
        context.fillRect(0, 0, width, height);
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

export async function takeContainerSnapshot(
  container: HTMLElement | null,
  options: SnapshotOptions = {},
): Promise<string> {
  if (!container) {
    throw new TypeError('Container must be an HTMLElement');
  }

  const format = options.format ?? 'image/jpeg'; // Дефолт на JPEG
  const quality = options.quality ?? 1.0;

  const canvases = Array.from(container.querySelectorAll('canvas'));

  // Если внутри уже есть готовый холст (например, Three.js) - берем его напрямую.
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