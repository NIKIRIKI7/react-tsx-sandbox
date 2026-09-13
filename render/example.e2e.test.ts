import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');

// По одному ключевому кадру на каждый фрагмент анимации.
const FRAMES = [75, 230, 400, 550, 700, 900, 1080];

describe('e2e: рендер анимации из examples/remotion-scene.tsx', () => {
  it('компилирует реальную сцену и рендерит кадры всех фрагментов + клип', () => {
    const result = spawnSync(process.execPath, [path.join('render', 'render-example.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    for (const frame of FRAMES) {
      const still = path.join(outDir, `example-frame-${String(frame).padStart(4, '0')}.png`);
      expect(existsSync(still), `кадр ${frame} не создан`).toBe(true);
      expect(statSync(still).size).toBeGreaterThan(10_000);
    }

    const clip = path.join(outDir, 'example-map.mp4');
    expect(existsSync(clip), 'клип не создан').toBe(true);
    expect(statSync(clip).size).toBeGreaterThan(100_000);
  });
});
