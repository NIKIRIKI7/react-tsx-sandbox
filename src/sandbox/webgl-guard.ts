/**
 * Принудительно высвобождает WebGL-контексты всех `<canvas>` внутри контейнера.
 * Защищает от краша браузера (`Too many active WebGL contexts`) при частых
 * перекомпиляциях сцен на Three.js / Pixi.js / @react-three/fiber.
 */
export function cleanupCanvasWebGl(container: HTMLElement | null): number {
  if (!container) return 0;

  let cleaned = 0;

  try {
    container.querySelectorAll('canvas').forEach((canvas) => {
      const gl =
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl') ||
        canvas.getContext('webgl2');

      if (gl) {
        const loseExt = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
        if (loseExt) {
          loseExt.loseContext();
          cleaned++;
        }
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[WebGL Guard]: ошибка очистки контекстов', error);
  }

  return cleaned;
}
