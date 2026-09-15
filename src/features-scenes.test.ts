import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { SandboxFacade } from './facade';
import { createTailwindPlugin, TAILWIND_VIRTUAL_MODULE } from './plugins/tailwind-plugin';
import { compileTsx } from './compiler/transform';
import { executeComponent } from './sandbox/evaluator';

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

const tailwindSource = read('examples/tailwind-jit-scene.tsx');
const hmrSource = read('examples/hmr-module-graph-scene.tsx');
const exportSource = read('examples/export-pipeline-scene.tsx');

// Заглушка Remotion для структурной проверки без плеера.
const RemotionStub = {
  AbsoluteFill: (props: any) => props,
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, durationInFrames: 150, width: 1280, height: 720 }),
  spring: () => 1,
  interpolate: (input: number) => input,
};

const LucideStub = new Proxy(
  {},
  {
    get: (_target, name) => (props: any) => ({ icon: name, props }),
  },
);

const registry = { react: React, remotion: RemotionStub, 'lucide-react': LucideStub };

describe('examples: сцены фич (tailwind-jit / hmr-module-graph / export-pipeline)', () => {
  it('компилируются через Sucrase и содержат remotion/lucide-зависимости', () => {
    for (const source of [tailwindSource, hmrSource, exportSource]) {
      const output = compileTsx(source);
      expect(output).toContain(`require('remotion')`);
      expect(output).toContain(`require('lucide-react')`);
      expect(output).toMatch(/exports\.\s*default/);
    }
  });

  it('tailwind-jit: выполняет сцену через песочницу с onResolve/onLoad плагином', async () => {
    const facade = new SandboxFacade(registry, { plugins: [createTailwindPlugin()] });
    const { component: Scene, error } = await facade.compile(tailwindSource);

    expect(error).toBeNull();
    expect(typeof Scene).toBe('function');

    const element = Scene() as any;
    // Новая модель: компонент НЕ обёрнут — виртуальный модуль инжектит <style> в head.
    expect(element.type).toBe(RemotionStub.AbsoluteFill);
    expect(element.props.className).toContain('relative');
    expect(tailwindSource).toContain(TAILWIND_VIRTUAL_MODULE);
  });

  it('hmr-module-graph: корневой элемент сцены — AbsoluteFill', () => {
    const Scene = executeComponent(compileTsx(hmrSource), registry, { staticFile: () => '' }) as any;
    const element = Scene();
    expect(element.type).toBe(RemotionStub.AbsoluteFill);
  });

  it('export-pipeline: корневой элемент сцены — AbsoluteFill', () => {
    const Scene = executeComponent(compileTsx(exportSource), registry, {
      staticFile: () => '',
    }) as any;
    const element = Scene();
    expect(element.type).toBe(RemotionStub.AbsoluteFill);
  });
});