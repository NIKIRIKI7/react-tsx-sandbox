import type { VirtualFileSystem } from './types';
import { logger } from './logger';

export interface SceneMetadata {
  id?: string;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
  defaultProps?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Скобко-осознанное извлечение тела объектного литерала конфига.
 *
 * Ищет `name = {` и затем сканирует посимвольно, отслеживая вложенность `{}`
 * и пропуская строковые/шаблонные литералы. В отличие от жадной регулярки
 * `\{([^}]+)\}`, корректно обрабатывает вложенные объекты:
 * `compositionConfig = { defaultProps: { user: { name: 'Alex' } } }`.
 */
function extractConfigObjectBody(raw: string, name: string): string | null {
  const headRe = new RegExp(`\\b${name}\\s*=\\s*\\{`);
  const head = headRe.exec(raw);
  if (!head) return null;

  const openIndex = head.index + head[0].lastIndexOf('{');
  let depth = 0;
  let quote: string | null = null;
  let i = openIndex;

  for (; i < raw.length; i++) {
    const ch = raw[i];

    if (quote) {
      if (ch === '\\') {
        i++;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return raw.slice(openIndex + 1, i);
      }
    }
  }

  return null;
}

/**
 * Автоматически извлекает параметры видео (хронометраж, FPS, размеры и пропсы)
 * из TSX-экспортов, статики компонента или JSON-конфигурации.
 *
 * Приоритет (от первого найденного):
 * 1. Вычисленные экспорты модуля (`compositionConfig`, `config`, `sceneConfig`, `metadata`)
 * 2. Именованные экспорты (`durationInFrames`, `fps`, `width`, `height`, `defaultProps`)
 * 3. Статические свойства компонента (`Component.durationInFrames` и т.д.)
 * 4. JSON-парсинг текстовых исходников (включая каталоги Vidora)
 * 5. Регулярные выражения по тексту TSX (`<Composition .../>`, `export const`, `compositionConfig = {...}`)
 */
export function extractSceneMetadata(
  input: string | VirtualFileSystem,
  evaluatedExports?: Record<string, any>,
  component?: any,
): SceneMetadata {
  logger.debug('extractSceneMetadata: старт извлечения параметров');
  const metadata: SceneMetadata = {};

  // ── 1. Вычисленные экспорты модуля ──────────────────────────────────
  if (evaluatedExports && typeof evaluatedExports === 'object') {
    const config =
      evaluatedExports.compositionConfig ||
      evaluatedExports.config ||
      evaluatedExports.sceneConfig ||
      evaluatedExports.metadata;

    if (config && typeof config === 'object') {
      if (typeof config.durationInFrames === 'number') metadata.durationInFrames = config.durationInFrames;
      else if (typeof config.durationFrames === 'number') metadata.durationInFrames = config.durationFrames;

      if (typeof config.fps === 'number') metadata.fps = config.fps;

      if (typeof config.width === 'number') metadata.width = config.width;
      else if (typeof config.compositionWidth === 'number') metadata.width = config.compositionWidth;

      if (typeof config.height === 'number') metadata.height = config.height;
      else if (typeof config.compositionHeight === 'number') metadata.height = config.compositionHeight;

      if (typeof config.id === 'string') metadata.id = config.id;

      if (config.defaultProps && typeof config.defaultProps === 'object') {
        metadata.defaultProps = { ...config.defaultProps };
      } else if (config.inputProps && typeof config.inputProps === 'object') {
        metadata.defaultProps = { ...config.inputProps };
      }
    }

    // Именованные прямые экспорты
    if (metadata.durationInFrames === undefined) {
      if (typeof evaluatedExports.durationInFrames === 'number') metadata.durationInFrames = evaluatedExports.durationInFrames;
      else if (typeof evaluatedExports.durationFrames === 'number') metadata.durationInFrames = evaluatedExports.durationFrames;
    }
    if (metadata.fps === undefined && typeof evaluatedExports.fps === 'number') {
      metadata.fps = evaluatedExports.fps;
    }
    if (metadata.width === undefined) {
      if (typeof evaluatedExports.width === 'number') metadata.width = evaluatedExports.width;
      else if (typeof evaluatedExports.compositionWidth === 'number') metadata.width = evaluatedExports.compositionWidth;
    }
    if (metadata.height === undefined) {
      if (typeof evaluatedExports.height === 'number') metadata.height = evaluatedExports.height;
      else if (typeof evaluatedExports.compositionHeight === 'number') metadata.height = evaluatedExports.compositionHeight;
    }
    if (!metadata.defaultProps) {
      if (evaluatedExports.defaultProps && typeof evaluatedExports.defaultProps === 'object') {
        metadata.defaultProps = { ...evaluatedExports.defaultProps };
      } else if (evaluatedExports.inputProps && typeof evaluatedExports.inputProps === 'object') {
        metadata.defaultProps = { ...evaluatedExports.inputProps };
      }
    }
    if (!metadata.id && typeof evaluatedExports.id === 'string') {
      metadata.id = evaluatedExports.id;
    }
  }

  // ── 2. Статические свойства компонента ──────────────────────────────
  if (component && (typeof component === 'function' || typeof component === 'object')) {
    const compConfig = component.compositionConfig || component.config;
    if (compConfig && typeof compConfig === 'object') {
      if (metadata.durationInFrames === undefined && typeof compConfig.durationInFrames === 'number') {
        metadata.durationInFrames = compConfig.durationInFrames;
      }
      if (metadata.fps === undefined && typeof compConfig.fps === 'number') {
        metadata.fps = compConfig.fps;
      }
      if (metadata.width === undefined && typeof compConfig.width === 'number') {
        metadata.width = compConfig.width;
      }
      if (metadata.height === undefined && typeof compConfig.height === 'number') {
        metadata.height = compConfig.height;
      }
      if (!metadata.defaultProps && compConfig.defaultProps && typeof compConfig.defaultProps === 'object') {
        metadata.defaultProps = { ...compConfig.defaultProps };
      }
    }

    if (metadata.durationInFrames === undefined && typeof component.durationInFrames === 'number') {
      metadata.durationInFrames = component.durationInFrames;
    }
    if (metadata.fps === undefined && typeof component.fps === 'number') {
      metadata.fps = component.fps;
    }
    if (metadata.width === undefined && typeof component.width === 'number') {
      metadata.width = component.width;
    }
    if (metadata.height === undefined && typeof component.height === 'number') {
      metadata.height = component.height;
    }
    if (!metadata.defaultProps && component.defaultProps && typeof component.defaultProps === 'object') {
      metadata.defaultProps = { ...component.defaultProps };
    }
  }

  // ── 3. Анализ текстовых и JSON-исходников ───────────────────────────
  const rawSources: string[] = [];
  if (typeof input === 'string') {
    rawSources.push(input);
  } else if (typeof input === 'object' && input !== null) {
    for (const [path, content] of Object.entries(input)) {
      if (path.endsWith('.json') || path.endsWith('.tsx') || path.endsWith('.ts')) {
        rawSources.push(content);
      }
    }
  }

  for (const raw of rawSources) {
    const trimmed = raw.trim();

    // Парсинг JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);

        // Формат каталога виджетов Vidora
        if (Array.isArray(parsed.widgets) && parsed.widgets.length > 0) {
          const widget = parsed.widgets[0];
          if (widget.default_props && typeof widget.default_props === 'object') {
            if (metadata.durationInFrames === undefined && typeof widget.default_props.durationFrames === 'number') {
              metadata.durationInFrames = widget.default_props.durationFrames;
            }
            if (!metadata.defaultProps) {
              metadata.defaultProps = { ...widget.default_props };
            }
          }
          if (typeof widget.id === 'string') {
            if (!metadata.id) metadata.id = widget.id;
            if (metadata.width === undefined && metadata.height === undefined) {
              if (widget.id.includes('9x16')) {
                metadata.width = 1080;
                metadata.height = 1920;
              } else if (widget.id.includes('16x9')) {
                metadata.width = 1920;
                metadata.height = 1080;
              }
            }
          }
          if (metadata.fps === undefined) metadata.fps = 30;
        }

        // Прямой JSON-конфиг сцены
        if (typeof parsed.durationInFrames === 'number' && metadata.durationInFrames === undefined) {
          metadata.durationInFrames = parsed.durationInFrames;
        } else if (typeof parsed.durationFrames === 'number' && metadata.durationInFrames === undefined) {
          metadata.durationInFrames = parsed.durationFrames;
        }
        if (typeof parsed.fps === 'number' && metadata.fps === undefined) {
          metadata.fps = parsed.fps;
        }
        if (typeof parsed.width === 'number' && metadata.width === undefined) {
          metadata.width = parsed.width;
        }
        if (typeof parsed.height === 'number' && metadata.height === undefined) {
          metadata.height = parsed.height;
        }
        if (typeof parsed.id === 'string' && !metadata.id) {
          metadata.id = parsed.id;
        }
        if (parsed.defaultProps && typeof parsed.defaultProps === 'object' && !metadata.defaultProps) {
          metadata.defaultProps = { ...parsed.defaultProps };
        }
      } catch {
        // Невалидный JSON — продолжаем
      }
    }

    // ── 4. Fallback: регулярные выражения по тексту TSX ───────────────

    let body: string | null = null;
    for (const configName of ['compositionConfig', 'sceneConfig'] as const) {
      body = extractConfigObjectBody(raw, configName);
      if (body) break;
    }

    if (body) {
      const dur = body.match(/durationInFrames\s*:\s*(\d+)/);
      if (dur && metadata.durationInFrames === undefined) metadata.durationInFrames = Number(dur[1]);
      const fpsM = body.match(/fps\s*:\s*(\d+)/);
      if (fpsM && metadata.fps === undefined) metadata.fps = Number(fpsM[1]);
      const wM = body.match(/width\s*:\s*(\d+)/);
      if (wM && metadata.width === undefined) metadata.width = Number(wM[1]);
      const hM = body.match(/height\s*:\s*(\d+)/);
      if (hM && metadata.height === undefined) metadata.height = Number(hM[1]);
      const idM = body.match(/id\s*:\s*['"]([^'"]+)['"]/);
      if (idM && !metadata.id) metadata.id = idM[1];
    }

    const compTagMatch = raw.match(/<Composition\b([^>]+)\/?>/);
    if (compTagMatch) {
      const tagBody = compTagMatch[1];
      const dur = tagBody.match(/durationInFrames=\{?(\d+)\}?/);
      if (dur && metadata.durationInFrames === undefined) metadata.durationInFrames = Number(dur[1]);
      const fpsM = tagBody.match(/fps=\{?(\d+)\}?/);
      if (fpsM && metadata.fps === undefined) metadata.fps = Number(fpsM[1]);
      const wM = tagBody.match(/width=\{?(\d+)\}?/);
      if (wM && metadata.width === undefined) metadata.width = Number(wM[1]);
      const hM = tagBody.match(/height=\{?(\d+)\}?/);
      if (hM && metadata.height === undefined) metadata.height = Number(hM[1]);
      const idM = tagBody.match(/id=['"]([^'"]+)['"]/);
      if (idM && !metadata.id) metadata.id = idM[1];
    }

    // Отдельные export const ...
    if (metadata.durationInFrames === undefined) {
      const m = raw.match(/export\s+const\s+durationInFrames\s*=\s*(\d+)/);
      if (m) metadata.durationInFrames = Number(m[1]);
    }
    if (metadata.fps === undefined) {
      const m = raw.match(/export\s+const\s+fps\s*=\s*(\d+)/);
      if (m) metadata.fps = Number(m[1]);
    }
    if (metadata.width === undefined) {
      const m = raw.match(/export\s+const\s+width\s*=\s*(\d+)/);
      if (m) metadata.width = Number(m[1]);
    }
    if (metadata.height === undefined) {
      const m = raw.match(/export\s+const\s+height\s*=\s*(\d+)/);
      if (m) metadata.height = Number(m[1]);
    }
  }

  logger.info('Извлеченные параметры сцены:', metadata);
  return metadata;
}
