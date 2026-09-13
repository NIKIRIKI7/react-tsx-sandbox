import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');

describe('e2e: Data-Driven Timeline (музыка + SFX + озвучка)', () => {
  it('сцена описывает таймлайн единым массивом Cue', () => {
    const sceneSource = readFileSync(
      path.join(projectRoot, 'examples', 'data-driven-timeline.tsx'),
      'utf8',
    );

    expect(sceneSource).toContain("from 'browser-tsx-sandbox'");
    expect(sceneSource).toContain('<MusicLayer');
    expect(sceneSource).toContain('<SFXLayer');
    expect(sceneSource).toContain('<TrackLayer');
    expect(sceneSource).toContain('useActiveCues');
    expect(sceneSource).toContain('SoundHelix-Song-1.mp3');
    expect(sceneSource).toContain('pop.ogg');
  });

  it('рендерит кадры, валидный H.264 и аудиодорожку AAC', () => {
    const result = spawnSync(process.execPath, [path.join('render', 'render-timeline.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    for (const frame of [45, 90, 150, 210]) {
      const still = path.join(outDir, `timeline-frame-${String(frame).padStart(3, '0')}.png`);
      expect(existsSync(still), `кадр ${frame} не создан`).toBe(true);
      expect(statSync(still).size).toBeGreaterThan(5_000);
    }

    const video = path.join(outDir, 'data-driven-timeline.mp4');
    expect(existsSync(video), 'видео не создано').toBe(true);
    expect(statSync(video).size).toBeGreaterThan(20_000);

    const verify = spawnSync(
      process.execPath,
      [
        path.join('render', 'verify-video.mjs'),
        path.join('render', 'out', 'data-driven-timeline.mp4'),
      ],
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
