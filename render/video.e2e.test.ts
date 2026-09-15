import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');
const sandboxVideo = path.join(outDir, 'sandbox.mp4');

function runVerify(relativeTarget: string) {
  return spawnSync(process.execPath, [path.join('render', 'verify-video.mjs'), relativeTarget], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

describe('e2e: проверка выдачи отрендеренного видео', () => {
  beforeAll(() => {
    if (!existsSync(sandboxVideo)) {
      const result = spawnSync(process.execPath, [path.join('render', 'render.mjs')], {
        cwd: projectRoot,
        encoding: 'utf8',
      });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }
  });

  it('sandbox.mp4 — валидный H.264 640x360 длительностью 2с (60 кадров)', () => {
    const result = runVerify(path.join('render', 'out', 'sandbox.mp4'));
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const [report] = JSON.parse(result.stdout);

    expect(report.file).toBe('sandbox.mp4');
    expect(report.bytes).toBeGreaterThan(10_000);
    expect(report.valid).toBe(true);

    expect(report.hasAvc1).toBe(true);
    expect(report.width).toBe(640);
    expect(report.height).toBe(360);
    expect(report.durationSeconds).toBeGreaterThan(1.9);
    expect(report.durationSeconds).toBeLessThan(2.1);

    if (report.ffprobe && !report.ffprobe.error) {
      expect(report.ffprobe.codec).toBe('h264');
      expect(report.ffprobe.width).toBe(640);
      expect(report.ffprobe.height).toBe(360);
      if (report.ffprobe.nbFrames !== undefined) {
        expect(report.ffprobe.nbFrames).toBe(60);
      }
    }
  });

  it('отклоняет файл, который не является валидным MP4', () => {
    mkdirSync(outDir, { recursive: true });
    const fake = path.join(outDir, 'not-a-video.mp4');
    writeFileSync(fake, 'this is definitely not an mp4 file');

    try {
      const result = runVerify(path.join('render', 'out', 'not-a-video.mp4'));
      expect(result.status).toBe(1);

      const [report] = JSON.parse(result.stdout);
      expect(report.valid).toBe(false);
      expect(report.error).toMatch(/ftyp/i);
    } finally {
      rmSync(fake, { force: true });
    }
  });

  it('sandbox.mp4 имеет ненулевой размер на диске', () => {
    expect(statSync(sandboxVideo).size).toBeGreaterThan(10_000);
  });
});
