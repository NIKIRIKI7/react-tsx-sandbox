import path from 'node:path';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(here, 'entry.tsx');
const publicDir = path.join(here, 'public');
const outDir = path.join(here, 'out');

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const browserExecutable = [
  process.env.REMOTION_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((candidate) => candidate && existsSync(candidate));

if (!browserExecutable) {
  throw new Error('Chrome not found. Set REMOTION_BROWSER to a Chrome/Edge executable path.');
}

console.log('[render] bundling sandbox entry...');
const serveUrl = await bundle({
  entryPoint,
  publicDir,
  outDir: path.join(here, 'bundle'),
  onProgress: (progress) => process.stdout.write(`\r[render] bundling ${progress}%   `),
});
console.log('\n[render] bundle ready:', serveUrl);

console.log('[render] selecting composition...');
const composition = await selectComposition({
  serveUrl,
  id: 'Sandbox',
  browserExecutable,
});
console.log('[render] composition:', composition.id, composition.width, 'x', composition.height);

const stillPath = path.join(outDir, 'frame-30.png');
await renderStill({
  serveUrl,
  composition,
  output: stillPath,
  frame: 30,
  browserExecutable,
});
console.log('[render] still:', stillPath, statSync(stillPath).size, 'bytes');

const videoPath = path.join(outDir, 'sandbox.mp4');
await renderMedia({
  serveUrl,
  composition,
  codec: 'h264',
  outputLocation: videoPath,
  browserExecutable,
  onProgress: ({ progress }) => process.stdout.write(`\r[render] video ${Math.round(progress * 100)}%   `),
});
console.log('\n[render] video:', videoPath, statSync(videoPath).size, 'bytes');
console.log('[render] DONE');
