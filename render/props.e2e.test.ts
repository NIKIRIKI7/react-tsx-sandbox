import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import * as Remotion from 'remotion';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';

interface VidoraWidget {
  id: string;
  tsx_code: string;
  default_props: Record<string, unknown>;
}

const renderDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(renderDir, '..');
const outDir = path.join(renderDir, 'out');

const catalog = JSON.parse(
  readFileSync(path.join(projectRoot, 'examples', 'vidora-widgets-logo.json'), 'utf8'),
) as { widgets: VidoraWidget[] };

const widget = catalog.widgets.find((w) => w.id === 'LogoShineBadge16x9')!;

const IconStub: React.FC<Record<string, unknown>> = (props) =>
  React.createElement('div', { 'data-icon': true, ...props });
const LucideStub = new Proxy(
  { __esModule: true },
  { get: (target: Record<string, unknown>, name: string) => (name in target ? target[name] : IconStub) },
);

function buildComponent() {
  return executeComponent(
    compileTsx(widget.tsx_code),
    { react: React, remotion: Remotion, 'lucide-react': LucideStub },
    { staticFile: (filename: string) => filename },
  );
}

function collect(node: any, out: any[] = []): any[] {
  if (node == null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => collect(child, out));
    return out;
  }
  if ('props' in node) {
    out.push(node);
    collect(node.props?.children, out);
  }
  return out;
}

describe('виджет LogoShineBadge16x9: пропсы меняют параметры', () => {
  it('подставляет logoText, size и logoColor из пропсов', () => {
    const Component = buildComponent();

    const first = collect(Component({ logoText: 'ALPHA', size: 260, logoColor: '#ff0000' }));
    expect(first.some((e) => e.type === 'span' && e.props.children === 'ALPHA')).toBe(true);
    expect(first.some((e) => e.props?.style?.width === '260px')).toBe(true);
    expect(first.some((e) => e.props?.style?.width === '380px')).toBe(true); // ореол = size + 120
    expect(first.some((e) => e.props?.style?.color === '#ff0000')).toBe(true);

    const second = collect(Component({ logoText: 'BETA', size: 400, logoColor: '#00ff00' }));
    expect(second.some((e) => e.type === 'span' && e.props.children === 'BETA')).toBe(true);
    expect(second.some((e) => e.props?.style?.width === '400px')).toBe(true);
    expect(second.some((e) => e.props?.style?.color === '#00ff00')).toBe(true);

    expect(first.some((e) => e.type === 'span' && e.props.children === 'BETA')).toBe(false);
  });

  it('рендерит imageUrl как <img> и игнорирует текстовый фолбэк', () => {
    const Component = buildComponent();
    const url = 'https://cdn.example.com/logo.png';

    const elements = collect(Component({ imageUrl: url, logoText: 'SHOULD_NOT_RENDER' }));

    expect(elements.some((e) => e.type === 'img' && e.props.src === url)).toBe(true);
    expect(elements.some((e) => e.type === 'span' && e.props.children === 'SHOULD_NOT_RENDER')).toBe(
      false,
    );
  });

  it('резолвит iconName через lucide-react и не показывает текст', () => {
    const Component = buildComponent();

    const elements = collect(Component({ iconName: 'Play', logoText: 'SHOULD_NOT_RENDER' }));

    expect(elements.some((e) => e.type === IconStub)).toBe(true);
    expect(elements.some((e) => e.type === 'span' && e.props.children === 'SHOULD_NOT_RENDER')).toBe(
      false,
    );
  });

  it('применяет дефолтные пропсы, когда ничего не передано', () => {
    const Component = buildComponent();

    const elements = collect(Component({}));

    expect(elements.some((e) => e.type === 'span' && e.props.children === 'Pr')).toBe(true);
    expect(elements.some((e) => e.props?.style?.width === '320px')).toBe(true);
  });
});

describe('e2e: реальный рендер вариаций пропсов', () => {
  it('рендерит разные PNG для разных значений пропсов и картинки', () => {
    const result = spawnSync(process.execPath, [path.join('render', 'render-props.mjs')], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const read = (id: string) => {
      const file = path.join(outDir, `props-${id}.png`);
      expect(existsSync(file), `${id} не создан`).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(3_000);
      return readFileSync(file);
    };

    const def = read('PropsDefault');
    const red = read('PropsRedSmall');
    const green = read('PropsGreenBig');
    const image = read('PropsImage');
    const icon = read('PropsIcon');

    expect(def.equals(red)).toBe(false);
    expect(red.equals(green)).toBe(false);
    expect(def.equals(image)).toBe(false);
    expect(def.equals(icon)).toBe(false);
  });
});
