import path from 'node:path';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(here, 'entry-assets.tsx');
const publicDir = path.join(here, 'public');
const outDir = path.join(here, 'out');
const requiredAsset = path.join(publicDir, 'assets', 'clip.mp4');

if (!existsSync(requiredAsset)) {
  throw new Error(
    `Asset not found: ${requiredAsset}. Unpack the ZIP into render/public before rendering.`,
  );
}
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const browserExecutable = [
  process.env.REMOTION_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((candidate) => candidate && existsSync(candidate));

if (!browserExecutable) {
  throw new Error('Chrome not found. Set REMOTION_BROWSER to a Chrome/Edge executable path.');
}

console.log('[assets] bundling sandbox entry...');
const serveUrl = await bundle({
  entryPoint,
  publicDir,
  outDir: path.join(here, 'bundle-assets'),
  onProgress: (progress) => process.stdout.write(`\r[assets] bundling ${progress}%   `),
});
console.log('\n[assets] bundle ready');

const composition = await selectComposition({
  serveUrl,
  id: 'SandboxAssets',
  browserExecutable,
});
console.log('[assets] composition:', composition.id, composition.width, 'x', composition.height);

const stillPath = path.join(outDir, 'asset-still.png');
await renderStill({
  serveUrl,
  composition,
  output: stillPath,
  frame: 45,
  browserExecutable,
});
console.log('[assets] still:', stillPath, statSync(stillPath).size, 'bytes');

const videoPath = path.join(outDir, 'asset-video.mp4');
await renderMedia({
  serveUrl,
  composition,
  codec: 'h264',
  outputLocation: videoPath,
  browserExecutable,
  onProgress: ({ progress }) => process.stdout.write(`\r[assets] video ${Math.round(progress * 100)}%   `),
});
console.log('\n[assets] video:', videoPath, statSync(videoPath).size, 'bytes');
console.log('[assets] DONE');
