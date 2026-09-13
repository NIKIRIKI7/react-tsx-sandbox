import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');

describe('e2e: анимация со звуком и музыкой (скачанные медиа)', () => {
  it('сцена использует скачанную музыку, SFX и синхронизацию по биту', () => {
    const sceneSource = readFileSync(
      path.join(projectRoot, 'examples', 'audio-animation-scene.tsx'),
      'utf8',
    );

    expect(sceneSource).toContain("from 'remotion'");
    expect(sceneSource).toContain('<Audio');
    expect(sceneSource).toContain('staticFile(');
    expect(sceneSource).toContain('audio/music.mp3');
    expect(sceneSource).toContain('audio/pop.ogg');
    expect(sceneSource).toContain('<Sequence');
  });

  it('рендерит кадры, валидный H.264 и аудиодорожку AAC', () => {
    const result = spawnSync(process.execPath, [path.join('render', 'render-animation.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    for (const frame of [45, 90, 135, 165]) {
      const still = path.join(outDir, `animation-frame-${String(frame).padStart(3, '0')}.png`);
      expect(existsSync(still), `кадр ${frame} не создан`).toBe(true);
      expect(statSync(still).size).toBeGreaterThan(5_000);
    }

    const video = path.join(outDir, 'sound-motion.mp4');
    expect(existsSync(video), 'видео не создано').toBe(true);
    expect(statSync(video).size).toBeGreaterThan(20_000);

    const verify = spawnSync(
      process.execPath,
      [path.join('render', 'verify-video.mjs'), path.join('render', 'out', 'sound-motion.mp4')],
      { cwd: projectRoot, encoding: 'utf8' },
    );
    expect(verify.status, `${verify.stdout}\n${verify.stderr}`).toBe(0);

    const [report] = JSON.parse(verify.stdout);
    expect(report.valid).toBe(true);
    expect(report.hasAvc1).toBe(true);
    expect(report.width).toBe(1280);
    expect(report.height).toBe(720);

    const bytes = readFileSync(video);
    expect(bytes.includes('mp4a')).toBe(true);
  });
});
