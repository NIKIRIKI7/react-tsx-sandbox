// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildCompositionSvgDataUrl,
  findCompositionElement,
  stripSandboxElements,
  takeContainerSnapshot,
} from './snapshot';

function decodeSvg(dataUrl: string): string {
  return decodeURIComponent(dataUrl.split(',')[1] ?? '');
}

function containerWithOverlayAndComposition(): HTMLElement {
  const container = document.createElement('div');

  const overlay = document.createElement('div');
  overlay.setAttribute('data-testid', 'safe-zones-overlay');
  overlay.setAttribute('data-sandbox-overlay', 'true');
  overlay.textContent = 'OVL';

  const composition = document.createElement('div');
  composition.setAttribute('data-remotion-canvas', 'true');
  composition.textContent = 'HELLO';

  container.appendChild(overlay);
  container.appendChild(composition);

  return container;
}

const realImage = globalThis.Image;

function mockRasterizeCanvas(): void {
  const origCreateElement = document.createElement.bind(document);

  vi.spyOn(document, 'createElement').mockImplementation(
    ((tag: string, options?: ElementCreationOptions) => {
      const element = origCreateElement(tag, options);
      if (tag.toLowerCase() === 'canvas') {
        Object.defineProperty(element, 'toDataURL', {
          value: vi.fn(() => 'data:image/png;base64,RASTER'),
          configurable: true,
        });
        Object.defineProperty(element, 'getContext', {
          value: () => ({
            clearRect() {},
            fillRect() {},
            drawImage() {},
          }),
          configurable: true,
        });
      }
      return element;
    }) as typeof document.createElement,
  );
}

describe('sandbox/snapshot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Image = realImage;
  });

  it('бросает ошибку без контейнера', async () => {
    await expect(takeContainerSnapshot(null)).rejects.toThrow(/container/i);
  });

  it('использует прямой canvas, если он есть', async () => {
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    const dataUrl = 'data:image/jpeg;base64,AAAA';

    canvas.toDataURL = vi.fn(() => dataUrl);
    container.appendChild(canvas);

    const result = await takeContainerSnapshot(container, { format: 'image/jpeg' });

    expect(result).toBe(dataUrl);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 1.0);
  });

  it('выбирает canvas с пропорциями таргета (1:1), а не первый попавшийся', async () => {
    const container = document.createElement('div');

    const small = document.createElement('canvas');
    small.width = 64;
    small.height = 64;
    small.toDataURL = vi.fn(() => 'smol');

    const full = document.createElement('canvas');
    full.width = 1080;
    full.height = 1920;
    full.toDataURL = vi.fn(() => 'full');

    container.appendChild(small);
    container.appendChild(full);

    const result = await takeContainerSnapshot(container, {
      format: 'image/jpeg',
      targetWidth: 1080,
      targetHeight: 1920,
    });

    expect(result).toBe('full');
    expect(full.toDataURL).toHaveBeenCalled();
  });

  it('находит композицию по data-remotion-canvas', () => {
    const container = containerWithOverlayAndComposition();
    expect(findCompositionElement(container)?.textContent).toBe('HELLO');
  });

  it('buildCompositionSvgDataUrl изолирует ТОЛЬКО композицию (без оверлеев)', () => {
    const container = containerWithOverlayAndComposition();
    const dataUrl = buildCompositionSvgDataUrl(container, 1080, 1920);
    const svg = decodeSvg(dataUrl);

    expect(svg).toContain('HELLO');
    expect(svg).not.toContain('OVL');
    expect(svg).not.toContain('safe-zones-overlay');
    expect(svg).not.toContain('sandbox-overlay');

    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1920"');
  });

  it('stripSandboxElements вырезает оверлеи из клона композиции', () => {
    const container = document.createElement('div');

    const composition = document.createElement('div');
    composition.setAttribute('data-remotion-canvas', 'true');

    const innerOverlay = document.createElement('div');
    innerOverlay.setAttribute('data-sandbox-overlay', 'true');

    const sparkle = document.createElement('span');
    sparkle.textContent = 'CONTENT';

    const audio = document.createElement('audio');

    composition.appendChild(innerOverlay);
    composition.appendChild(audio);
    composition.appendChild(sparkle);
    container.appendChild(composition);

    const clone = container.cloneNode(true) as HTMLElement;
    stripSandboxElements(clone);

    expect(clone.querySelectorAll('[data-sandbox-overlay]').length).toBe(0);
    expect(clone.querySelectorAll('audio, video').length).toBe(1);
    expect(clone.textContent).toContain('CONTENT');
  });

  it('растеризует SVG через canvas и отдаёт png data URL', async () => {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        void value;
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image;
    mockRasterizeCanvas();

    const container = containerWithOverlayAndComposition();
    const dataUrl = await takeContainerSnapshot(container, {
      format: 'image/png',
      targetWidth: 1080,
      targetHeight: 1920,
    });

    expect(dataUrl).toBe('data:image/png;base64,RASTER');
  });

  it('при сбое растеризации отдаёт SVG data URL как fallback', async () => {
    class FakeBrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        void value;
        queueMicrotask(() => this.onerror?.());
      }
    }
    globalThis.Image = FakeBrokenImage as unknown as typeof Image;
    mockRasterizeCanvas();

    const container = containerWithOverlayAndComposition();
    const dataUrl = await takeContainerSnapshot(container, {
      format: 'image/png',
      targetWidth: 1080,
      targetHeight: 1920,
    });

    expect(dataUrl).toMatch(/^data:image\/svg\+xml/);
    expect(decodeSvg(dataUrl)).toContain('HELLO');
    expect(decodeSvg(dataUrl)).not.toContain('safe-zones-overlay');
  });
});