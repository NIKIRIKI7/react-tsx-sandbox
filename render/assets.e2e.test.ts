import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { createAssetUrlMap, extractAssetZip } from '../src/assets/zip';

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');
const publicDir = path.join(renderDir, 'public');

function runScript(script: string) {
  const result = spawnSync(process.execPath, [path.join('render', script)], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80">
  <rect width="240" height="80" rx="12" fill="#4fdbc8"/>
  <text x="120" y="52" font-family="Arial" font-size="30" font-weight="bold" text-anchor="middle" fill="#0b1326">QWEN 3.8</text>
</svg>`;

describe('e2e: реальный рендер с ассетами из ZIP', () => {
  beforeAll(() => {
    if (!existsSync(path.join(outDir, 'sandbox.mp4'))) runScript('render.mjs');
  });

  it('распаковывает ZIP, раздаёт ассеты и рендерит сцену с видео и картинкой', () => {
    const clip = readFileSync(path.join(outDir, 'sandbox.mp4'));

    const zip = zipSync({
      'assets/clip.mp4': clip,
      'assets/logo.svg': strToU8(LOGO_SVG),
      'assets/meta.json': strToU8(JSON.stringify({ title: 'Qwen 3.8' })),
      '__MACOSX/._clip.mp4': strToU8('junk'),
    });

    const archive = extractAssetZip(zip);
    expect(Object.keys(archive).sort()).toEqual(['assets/clip.mp4', 'assets/logo.svg', 'assets/meta.json']);

    const urlMap = createAssetUrlMap(archive, (_bytes, filename) => `blob:${filename}`);
    expect(urlMap['clip.mp4']).toBe('blob:clip.mp4');
    expect(urlMap['logo.svg']).toBe('blob:logo.svg');

    for (const [assetPath, bytes] of Object.entries(archive)) {
      const destination = path.join(publicDir, assetPath);
      mkdirSync(path.dirname(destination), { recursive: true });
      writeFileSync(destination, bytes);
    }

    runScript('render-assets.mjs');

    const still = path.join(outDir, 'asset-still.png');
    const video = path.join(outDir, 'asset-video.mp4');

    expect(existsSync(still), 'PNG-кадр с ассетами не создан').toBe(true);
    expect(existsSync(video), 'MP4 с ассетами не создан').toBe(true);
    expect(statSync(still).size).toBeGreaterThan(1_000);
    expect(statSync(video).size).toBeGreaterThan(10_000);
  });
});
