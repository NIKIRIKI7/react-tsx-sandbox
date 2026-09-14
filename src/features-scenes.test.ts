import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { SandboxFacade } from './facade';
import { createTailwindJitPlugin } from './plugins/tailwind-plugin';
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

  it('tailwind-jit: выполняет сцену через песочницу с JIT-плагином и внедряет scoped-CSS', async () => {
    const facade = new SandboxFacade(registry, { plugins: [createTailwindJitPlugin()] });
    const { component: Scene, error } = await facade.compile(tailwindSource);

    expect(error).toBeNull();
    expect(typeof Scene).toBe('function');

    const element = Scene() as any;
    // Обёртка плагина: корневой div с scoped-классом + встроенный <style>.
    expect(typeof element.props.className).toBe('string');
    expect(element.props.className.startsWith('__tsx_tw-')).toBe(true);

    const children = (element.props.children ?? []).filter(Boolean);
    const styleTag = children.find((c: any) => c?.type === 'style');
    expect(styleTag).toBeTruthy();
    expect(String(styleTag.props.dangerouslySetInnerHTML?.__html ?? '')).toContain(
      element.props.className,
    );
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