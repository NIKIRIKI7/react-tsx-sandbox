import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { SandboxFacade } from '../facade';
import { ModuleCache } from './cache';
import { loadMissingModules, type ModuleImporter } from './loader';

/**
 * Node-адаптер esm.sh: скачивает shim, находит самодостаточный bundle и
 * импортирует его из временного файла. Так мы проверяем реальную загрузку
 * библиотек с CDN вне браузера (в браузере это делает нативный import).
 */
const nodeCdnImporter: ModuleImporter = async (url) => {
  if (!url.startsWith('https://esm.sh/')) throw new Error(`Unexpected CDN url: ${url}`);

  const shimRes = await fetch(`${url}?bundle`);
  if (!shimRes.ok) throw new Error(`HTTP ${shimRes.status} on ${url}?bundle`);
  const shim = await shimRes.text();

  const targets = [...shim.matchAll(/(?:from|import)\s*["'](\/[^"']+)["']/g)].map((m) => m[1]);
  const bundlePath = targets.find((t) => !t.startsWith('/react')) ?? targets[targets.length - 1];
  if (!bundlePath) throw new Error(`No bundle target in esm.sh shim for ${url}`);

  const bundleRes = await fetch(`https://esm.sh${bundlePath}`);
  if (!bundleRes.ok) throw new Error(`HTTP ${bundleRes.status} on ${bundlePath}`);
  const code = (await bundleRes.text()).replace(/\/\/# sourceMappingURL=.*$/gm, '');

  const nested = [...code.matchAll(/(?:from|import)\s*["'](\/[^"']+)["']/g)];
  if (nested.length > 0) {
    throw new Error(`Bundle ${bundlePath} is not self-contained (external imports present).`);
  }

  const hash = createHash('sha1').update(bundlePath).digest('hex').slice(0, 12);
  const file = path.join(os.tmpdir(), `esmsh-${hash}.mjs`);
  writeFileSync(file, code);

  return import(pathToFileURL(file).href);
};

describe('CDN: реальное скачивание библиотек с esm.sh', () => {
  it('загружает d3 через ModuleCache + loadMissingModules', async () => {
    const cache = new ModuleCache();

    await loadMissingModules(['d3'], cache, nodeCdnImporter);

    expect(cache.has('d3')).toBe(true);
    expect(typeof cache.get('d3').range).toBe('function');
  });

  it('скачивает самодостаточные бандлы three и canvas-confetti', async () => {
    const resThree = await fetch('https://esm.sh/three?bundle');
    const resConfetti = await fetch('https://esm.sh/canvas-confetti?bundle');

    expect(resThree.status).toBe(200);
    expect(resThree.headers.get('content-type')).toContain('javascript');
    expect(resConfetti.status).toBe(200);
  });

  it('скачивает framer-motion (shim + bundle), внешний React ожидаем', async () => {
    const shim = await (await fetch('https://esm.sh/framer-motion?bundle')).text();
    const bundlePath = shim.match(/\/framer-motion@[^"']+\.bundle\.mjs/)?.[0];

    expect(bundlePath, 'framer-motion bundle path not found').toBeTruthy();

    const bundle = await fetch(`https://esm.sh${bundlePath}`);
    expect(bundle.status).toBe(200);
    const code = await bundle.text();
    expect(code.length).toBeGreaterThan(1000);
    expect(code).toContain('react');
  });

  it('компилирует и выполняет компонент, использующий d3, three и canvas-confetti', async () => {
    const facade = new SandboxFacade({ react: React }, nodeCdnImporter);

    const result = await facade.compile(`
      import React from 'react';
      import { range, max, mean } from 'd3';
      import * as THREE from 'three';
      import confetti from 'canvas-confetti';

      export default function Scene() {
        const values = range(10).map((i) => Math.sin(i));
        const vec = new THREE.Vector3(3, 4, 0);
        return {
          max: max(values),
          mean: mean(values),
          length: vec.length(),
          confettiType: typeof confetti,
        };
      }
    `);

    expect(result.error).toBeNull();
    expect(typeof result.component).toBe('function');

    const output = result.component();
    expect(output.max).toBeCloseTo(Math.max(...Array.from({ length: 10 }, (_, i) => Math.sin(i))), 5);
    expect(output.length).toBeCloseTo(5, 5);
    expect(output.confettiType).toBe('function');
  });
});
