import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');

describe('e2e: рендер анимации с Tailwind + lucide + d3/three (esm.sh)', () => {
  it('Tailwind компилирует утилиты, а сцена использует lucide и внешние библиотеки', () => {
    const sceneSource = readFileSync(path.join(renderDir, 'showcase-scene.tsx'), 'utf8');

    expect(sceneSource).toContain("from 'lucide-react'");
    expect(sceneSource).toContain("from 'd3'");
    expect(sceneSource).toContain("from 'three'");

    const result = spawnSync(process.execPath, [path.join('render', 'render-showcase.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const generatedCss = readFileSync(
      path.join(renderDir, '.generated', 'showcase-css.ts'),
      'utf8',
    );
    for (const utility of ['.flex', '.grid-cols-4', '.rounded-2xl', '.shadow-2xl', '.bg-slate-950']) {
      expect(generatedCss, utility).toContain(utility);
    }
  });

  it('рендерит кадры и валидный H.264 из сцены с библиотеками', () => {
    for (const frame of [30, 75]) {
      const still = path.join(outDir, `showcase-frame-${String(frame).padStart(3, '0')}.png`);
      expect(existsSync(still), `кадр ${frame} не создан`).toBe(true);
      expect(statSync(still).size).toBeGreaterThan(5_000);
    }

    const video = path.join(outDir, 'showcase.mp4');
    expect(existsSync(video), 'видео не создано').toBe(true);
    expect(statSync(video).size).toBeGreaterThan(20_000);

    const verify = spawnSync(
      process.execPath,
      [path.join('render', 'verify-video.mjs'), path.join('render', 'out', 'showcase.mp4')],
      { cwd: projectRoot, encoding: 'utf8' },
    );
    expect(verify.status, `${verify.stdout}\n${verify.stderr}`).toBe(0);

    const [report] = JSON.parse(verify.stdout);
    expect(report.valid).toBe(true);
    expect(report.hasAvc1).toBe(true);
    expect(report.width).toBe(1280);
    expect(report.height).toBe(720);
  });
});
