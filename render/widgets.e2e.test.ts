import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTsx } from '../src/compiler/transform';
import { extractBareImports } from '../src/compiler/analyzer';

interface VidoraWidget {
  id: string;
  name: string;
  tsx_code: string;
  default_props: Record<string, unknown>;
}

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');
const STILL_FRAMES = [30, 60, 130, 230];

const catalog = JSON.parse(
  readFileSync(path.join(projectRoot, 'examples', 'vidora-widgets.json'), 'utf8'),
) as { vidora_schema_version: string; widgets: VidoraWidget[] };

describe('e2e: JSON-каталог виджетов Vidora через песочницу', () => {
  it('валиден, и каждый tsx_code компилируется песочницей', () => {
    expect(catalog.vidora_schema_version).toBe('1.0');
    expect(catalog.widgets).toHaveLength(2);

    for (const widget of catalog.widgets) {
      expect(typeof widget.tsx_code).toBe('string');
      expect(widget.tsx_code.length).toBeGreaterThan(100);
      expect(Object.keys(widget.default_props).length).toBeGreaterThan(0);
      expect(() => compileTsx(widget.tsx_code), widget.id).not.toThrow();
      expect(extractBareImports(widget.tsx_code)).toContain('remotion');
    }
  });

  it('рендерит кадры каждого виджета и короткий клип', () => {
    const result = spawnSync(process.execPath, [path.join('render', 'render-widgets.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    for (const widget of catalog.widgets) {
      for (const frame of STILL_FRAMES) {
        const still = path.join(outDir, `widget-${widget.id}-${String(frame).padStart(3, '0')}.png`);
        expect(existsSync(still), `кадр ${widget.id}@${frame} не создан`).toBe(true);
        expect(statSync(still).size).toBeGreaterThan(5_000);
      }
    }

    const clip = path.join(outDir, `widget-${catalog.widgets[0].id}.mp4`);
    expect(existsSync(clip), 'клип не создан').toBe(true);
    expect(statSync(clip).size).toBeGreaterThan(50_000);
  });
});
