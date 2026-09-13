import path from 'node:path';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'public');
const outDir = path.join(here, 'out');

for (const dir of [publicDir, outDir]) mkdirSync(dir, { recursive: true });

const browserExecutable = [
  process.env.REMOTION_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((candidate) => candidate && existsSync(candidate));
if (!browserExecutable) throw new Error('Chrome not found. Set REMOTION_BROWSER.');

console.log('[cdn] bundling sandbox entry...');
const serveUrl = await bundle({
  entryPoint: path.join(here, 'entry-cdn.tsx'),
  publicDir,
  outDir: path.join(here, 'bundle-cdn'),
  onProgress: (progress) => process.stdout.write(`\r[cdn] bundling ${progress}%   `),
});
console.log('\n[cdn] bundle ready');

const composition = await selectComposition({ serveUrl, id: 'CdnLibs', browserExecutable });
console.log('[cdn] composition:', composition.id, composition.width, 'x', composition.height);

const stillPath = path.join(outDir, 'cdn-libs.png');
await renderStill({ serveUrl, composition, output: stillPath, frame: 30, browserExecutable });
console.log('[cdn] still:', stillPath, statSync(stillPath).size, 'bytes');

const videoPath = path.join(outDir, 'cdn-libs.mp4');
await renderMedia({
  serveUrl,
  composition,
  codec: 'h264',
  outputLocation: videoPath,
  browserExecutable,
  onProgress: ({ progress }) =>
    process.stdout.write(`\r[cdn] video ${Math.round(progress * 100)}%   `),
});
console.log('\n[cdn] video:', videoPath, statSync(videoPath).size, 'bytes');
console.log('[cdn] DONE');
