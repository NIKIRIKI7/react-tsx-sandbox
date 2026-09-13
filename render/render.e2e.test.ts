import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');

describe('e2e: реальный рендер видео через Remotion', () => {
  it('рендерит PNG-кадр и MP4 из сцены, скомпилированной песочницей', () => {
    const result = spawnSync(process.execPath, [path.join('render', 'render.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const still = path.join(outDir, 'frame-30.png');
    const video = path.join(outDir, 'sandbox.mp4');

    expect(existsSync(still), 'PNG-кадр не создан').toBe(true);
    expect(existsSync(video), 'MP4 не создан').toBe(true);
    expect(statSync(still).size).toBeGreaterThan(1_000);
    expect(statSync(video).size).toBeGreaterThan(10_000);
  });
});
