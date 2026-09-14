import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');
const read = (rel: string) => readFileSync(path.join(projectRoot, rel), 'utf8');

describe('e2e: анимации фич — Tailwind JIT, HMR-граф, экспорт-пайплайн', () => {
  it('tailwind-jit сцена: className коллектор и рантайм-JIT темой', () => {
    const scene = read('examples/tailwind-jit-scene.tsx');
    expect(scene).toContain("from 'remotion'");
    expect(scene).toContain('className');
    expect(scene).toContain('bg-rose-500');
    expect(scene).toContain('text-7xl');
    expect(scene).toContain('animate-pulse');
    expect(scene).toContain('animate-spin');

    const entry = read('render/entry-features.tsx');
    expect(entry).toContain('createTailwindJitPlugin');
    expect(entry).toContain('plugins: [createTailwindJitPlugin()]');
  });

  it('hmr-module-graph сцена: граф зависимостей и граница HMR', () => {
    const scene = read('examples/hmr-module-graph-scene.tsx');
    expect(scene).toContain("from 'remotion'");
    expect(scene).toContain('app.tsx');
    expect(scene).toContain('labels.ts');
    expect(scene).toContain('recompiled');
    expect(scene).toContain('kept from cache');

    const vfs = JSON.parse(read('examples/hmr-sandbox.vfs.json')) as Record<string, string>;
    expect(Object.keys(vfs)).toEqual(['/App.tsx', '/labels.ts', '/theme.ts', '/store.ts', '/util.ts']);

    const entry = read('render/entry-features.tsx');
    expect(entry).toContain('hmrUpdate');
    // Вторая итерация обновляет label — компонент рендерится ПОСЛЕ hmrUpdate.
    expect(vfs['/App.tsx']).toContain('import { label, beats } from');
  });

  it('export-pipeline сцена: WebCodecs/VP9/EBML тема', () => {
    const scene = read('examples/export-pipeline-scene.tsx');
    expect(scene).toContain("from 'remotion'");
    expect(scene).toContain('WebCodecs');
    expect(scene).toContain('video/vp9');
    expect(scene).toContain('EBML');
    expect(scene).toContain('.webm');
  });

  it('рендерит кадры всех сцен и валидное H.264-видео', () => {
    const result = spawnSync(process.execPath, [path.join('render', 'render-features.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    for (const file of [
      'features-FeaturesTailwind-060.png',
      'features-FeaturesTailwind-120.png',
      'features-FeaturesHmr-080.png',
      'features-FeaturesHmr-140.png',
      'features-FeaturesExportPipeline-030.png',
      'features-FeaturesExportPipeline-090.png',
      'features-FeaturesExportPipeline-140.png',
    ]) {
      const still = path.join(outDir, file);
      expect(existsSync(still), `кадр ${file} не создан`).toBe(true);
      expect(statSync(still).size, `кадр ${file} пуст`).toBeGreaterThan(5_000);
    }

    const video = path.join(outDir, 'features-pipeline.mp4');
    expect(existsSync(video), 'видео не создано').toBe(true);
    expect(statSync(video).size).toBeGreaterThan(20_000);

    const verify = spawnSync(
      process.execPath,
      [path.join('render', 'verify-video.mjs'), path.join('render', 'out', 'features-pipeline.mp4')],
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