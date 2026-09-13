import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');

describe('e2e: живой импорт библиотек с esm.sh в браузере', () => {
  it('рендерит сцену, использующую d3 и three, скачанные с CDN', () => {
    const result = spawnSync(process.execPath, [path.join('render', 'render-cdn.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const still = path.join(outDir, 'cdn-libs.png');
    const video = path.join(outDir, 'cdn-libs.mp4');

    expect(existsSync(still), 'кадр не создан').toBe(true);
    expect(existsSync(video), 'видео не создано').toBe(true);
    expect(statSync(still).size).toBeGreaterThan(3_000);
    expect(statSync(video).size).toBeGreaterThan(5_000);
  });

  it('выданный CDN-видеофайл валиден (h264, 640x360)', () => {
    const result = spawnSync(
      process.execPath,
      [path.join('render', 'verify-video.mjs'), path.join('render', 'out', 'cdn-libs.mp4')],
      { cwd: projectRoot, encoding: 'utf8' },
    );
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const [report] = JSON.parse(result.stdout);
    expect(report.valid).toBe(true);
    expect(report.hasAvc1).toBe(true);
    expect(report.width).toBe(640);
    expect(report.height).toBe(360);
  });
});
