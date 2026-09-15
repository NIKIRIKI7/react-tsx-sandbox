import React, { useEffect, useState } from 'react';
import * as Remotion from 'remotion';
import { Composition, delayRender, continueRender, registerRoot } from 'remotion';
import {
  Activity,
  Camera,
  Codesandbox,
  Cpu,
  Download,
  FileVideo,
  GitBranch,
  Layers,
  Package,
  Radio,
  RefreshCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { SandboxFacade } from '../src/facade';
import { createTailwindPlugin } from '../src/plugins/tailwind-plugin';
import { compileTsx } from '../src/compiler/transform';
import { executeComponent } from '../src/sandbox/evaluator';
import { tailwindSource, hmrSource, exportSource, hmrVfs, hmrVfsHot } from './.generated/features-scenes';

const Lucide = {
  Activity,
  Camera,
  Codesandbox,
  Cpu,
  Download,
  FileVideo,
  GitBranch,
  Layers,
  Package,
  Radio,
  RefreshCcw,
  Sparkles,
  Zap,
};

interface HmrStats {
  changed: string[];
  added: string[];
  removed: string[];
  recompiled: string[];
  kept: string[];
}

async function buildTailwind() {
  // Tailwind JIT: компонент компилируется ПЕСОЧНИЦЕЙ с плагином — scoped CSS
  // собирается из className прямо в рантайме браузера.
  const facade = new SandboxFacade(
    { react: React, remotion: Remotion, 'lucide-react': Lucide },
    { plugins: [createTailwindPlugin()] },
  );
  const result = await facade.compile(tailwindSource);
  if (result.error) throw result.error;
  return { component: result.component as React.FC };
}

async function buildHmr() {
  // HMR: два инкрементальных обновления VFS дают реальную статистику HMR,
  // которой мы подсвечиваем визуальную сцену «графа».
  const facade = new SandboxFacade({ react: React, remotion: Remotion, 'lucide-react': Lucide });
  const first = await facade.hmrUpdate(hmrVfs);
  if (first.error) throw first.error;
  const second = await facade.hmrUpdate({ ...hmrVfs, ...(hmrVfsHot as Record<string, string>) });
  if (second.error) throw second.error;

  const graphScene = executeComponent(
    compileTsx(hmrSource),
    { react: React, remotion: Remotion, 'lucide-react': Lucide },
    { staticFile: () => '' },
  );

  return { component: graphScene as React.FC, hmrStats: second.hmr as HmrStats };
}

function buildExport() {
  return executeComponent(
    compileTsx(exportSource),
    { react: React, remotion: Remotion, 'lucide-react': Lucide },
    { staticFile: () => '' },
  ) as React.FC;
}

// Модульные промисы без top-level await: каждая сцена грузится один раз
// и дорисовывается через delayRender/continueRender внутри Composition.
const tailwindPromise = buildTailwind();
const hmrPromise = buildHmr();
const ExportScene = buildExport();

function HmrOverlay({ stats, children }: { stats: HmrStats; children: React.ReactNode }) {
  const recompiled = stats.recompiled.filter((f) => f !== '/App.tsx');
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 20,
          fontFamily: 'monospace',
          fontSize: 13,
          color: '#94a3b8',
          background: 'rgba(15,23,42,0.92)',
          border: '1px solid #1e293b',
          borderRadius: 10,
          padding: '10px 14px',
          maxWidth: 320,
        }}
      >
        <div style={{ color: '#a78bfa', marginBottom: 6, letterSpacing: 1 }}>
          HMR REPORT — second update
        </div>
        <div>changed: {stats.changed.join(', ') || '—'}</div>
        <div style={{ color: '#67e8f9' }}>recompiled: {recompiled.join(', ') || '—'}</div>
        <div style={{ color: '#34d399' }}>kept from cache: {stats.kept.length} modules</div>
      </div>
      {children}
    </>
  );
}

function SceneFrame({
  prepare,
  render,
}: {
  prepare: Promise<{ component: React.FC; [k: string]: any }>;
  render: (bundle: { component: React.FC; [k: string]: any }) => React.ReactNode;
}) {
  const [handle] = useState(() => delayRender('features-scene'));
  const [bundle, setBundle] = useState<{ component: React.FC; [k: string]: any } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    prepare
      .then((b) => {
        if (alive) setBundle(b);
      })
      .catch((cause: Error) => {
        if (alive) setError(cause);
      })
      .finally(() => continueRender(handle));
    return () => {
      alive = false;
    };
  }, [handle, prepare]);

  if (error) throw error;
  if (!bundle) return null;
  return <>{render(bundle)}</>;
}

const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="FeaturesTailwind"
        component={() => <SceneFrame prepare={tailwindPromise} render={({ component: Scene }) => <Scene />} />}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="FeaturesHmr"
        component={() => (
          <SceneFrame
            prepare={hmrPromise}
            render={({ component: Scene, hmrStats }) => (
              <HmrOverlay stats={hmrStats}>
                <Scene />
              </HmrOverlay>
            )}
          />
        )}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="FeaturesExportPipeline"
        component={ExportScene}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};

registerRoot(Root);