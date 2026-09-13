export interface SnapshotOptions {
  /** MIME-тип изображения. По умолчанию `image/png`. */
  format?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** Качество для jpeg/webp (0..1). */
  quality?: number;
  /** Масштаб растеризации. По умолчанию 1. */
  scale?: number;
}

function tryDirectCanvas(
  container: HTMLElement,
  format: SnapshotOptions['format'],
  quality: number,
): string | null {
  const canvas = container.querySelector('canvas');
  if (!canvas) return null;

  try {
    return canvas.toDataURL(format, quality);
  } catch {
    // Canvas мог быть «испорчен» (tainted) — идём в DOM-растеризацию.
    return null;
  }
}

function rasterize(
  svgString: string,
  width: number,
  height: number,
  format: SnapshotOptions['format'],
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
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Не удалось инициализировать 2D-контекст canvas.'));
      return;
    }

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      try {
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL(format, quality));
      } catch (error) {
        reject(error as Error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось растеризовать кадр в canvas.'));
    };
    image.src = url;
  });
}

/**
 * Снимает текущий кадр плеера в data-URL прямо в браузере (Zero-Backend).
 *
 * Порядок: готовый `<canvas>` (WebGL/2D) → растеризация DOM через
 * SVG `<foreignObject>` → SVG data-URL (best-effort, если браузер пометил
 * canvas как tainted).
 */
export async function takeContainerSnapshot(
  container: HTMLElement | null,
  options: SnapshotOptions = {},
): Promise<string> {
  if (!container) {
    throw new Error('Контейнер плеера не найден для создания скриншота.');
  }

  const { format = 'image/png', quality = 0.95, scale = 1 } = options;

  const direct = tryDirectCanvas(container, format, quality);
  if (direct) return direct;

  const rect = container.getBoundingClientRect();
  const width = Math.max(1, Math.round((rect.width || 1920) * scale));
  const height = Math.max(1, Math.round((rect.height || 1080) * scale));

  const clone = container.cloneNode(true) as HTMLElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  // Медиа-элементы не нужны в постере и могут «пачкать» canvas (taint).
  clone.querySelectorAll('audio, video').forEach((element) => element.remove());

  const svgString =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%">` +
    `${new XMLSerializer().serializeToString(clone)}` +
    `</foreignObject></svg>`;

  try {
    return await rasterize(svgString, width, height, format, quality);
  } catch {
    // Chrome может «пачкать» canvas при foreignObject — отдаём SVG как есть.
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  }
}
