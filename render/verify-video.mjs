import { readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseMp4 } from './mp4-metadata.mjs';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node render/verify-video.mjs <file.mp4 | directory>');
  process.exit(2);
}

function listVideos(input) {
  const stat = statSync(input);
  if (stat.isDirectory()) {
    return readdirSync(input)
      .filter((name) => name.endsWith('.mp4'))
      .map((name) => path.join(input, name));
  }
  return [input];
}

function ffprobeAvailable() {
  const probe = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
  return probe.status === 0;
}

function probeWithFfprobe(file) {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_name,width,height,nb_frames,r_frame_rate',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      file,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) return { error: (result.stderr || 'ffprobe failed').trim() };

  const parsed = JSON.parse(result.stdout);
  const stream = parsed.streams?.[0] ?? {};
  return {
    codec: stream.codec_name,
    width: stream.width,
    height: stream.height,
    nbFrames: stream.nb_frames ? Number(stream.nb_frames) : undefined,
    fps: stream.r_frame_rate,
    durationSeconds: parsed.format?.duration ? Number(parsed.format.duration) : undefined,
  };
}

const files = listVideos(target);
if (files.length === 0) {
  console.error(`No .mp4 files found at ${target}`);
  process.exit(2);
}

const withFfprobe = ffprobeAvailable();
let failed = false;
const reports = [];

for (const file of files) {
  try {
    const buffer = readFileSync(file);
    const meta = parseMp4(buffer);
    const valid =
      meta.hasMoov &&
      meta.width > 0 &&
      meta.height > 0 &&
      meta.durationSeconds > 0 &&
      meta.hasAvc1;

    const report = {
      file: path.basename(file),
      bytes: buffer.length,
      ...meta,
      valid,
    };

    if (withFfprobe) {
      report.ffprobe = probeWithFfprobe(file);
    }

    reports.push(report);
    if (!valid) failed = true;
  } catch (error) {
    reports.push({ file: path.basename(file), error: error.message, valid: false });
    failed = true;
  }
}

console.log(JSON.stringify(reports, null, 2));
process.exit(failed ? 1 : 0);
