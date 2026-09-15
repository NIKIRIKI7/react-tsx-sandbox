# 📚 API Reference — browser-tsx-sandbox

**Pure client-side TSX compiler, sandbox evaluator and Remotion video toolkit.**
Компилирует TSX в браузере, подгружает npm-пакеты с CDN, изолированно исполняет код и рендерит его в `@remotion/player`.

- 📦 Пакет: `browser-tsx-sandbox` (environment)
- 🧩 Subpath плеера: `browser-tsx-sandbox/player`
- 🟦 TypeScript-типы включены (`dist/*.d.ts`)
- ⚖️ License: MIT

```bash
# ядро
npm install browser-tsx-sandbox react

# живой предпросмотр
npm install browser-tsx-sandbox react remotion @remotion/player
```

---

## Содержание

1. [Быстрый старт](#1-быстрый-старт)
2. [Карта публичного API](#2-карта-публичного-api)
3. [`SandboxFacade`](#3-sandboxfacade)
4. [`useLiveSandbox`](#4-uselivesandbox)
5. [`<Sandbox>`](#5-sandbox)
6. [`<PlayerSandbox>`](#6-playersandbox)
7. [Headless UI плеера](#7-headless-ui-плеера)
8. [Data-Driven Timeline](#8-data-driven-timeline)
9. [Компилятор](#9-компилятор)
10. [Library Manager (CDN)](#10-library-manager-cdn)
11. [Исполнение и изоляция](#11-исполнение-и-изоляция)
12. [Ассеты и ZIP](#12-ассеты-и-zip)
13. [Аудио и видео-пайплайн](#13-аудио-и-видео-пайплайн)
14. [Рендер-харнесс](#14-рендер-харнесс)
15. [Вспомогательные утилиты](#15-вспомогательные-утилиты)
16. [Базовые типы](#16-базовые-типы)
17. [Ошибки](#17-ошибки)
18. [Модель безопасности](#18-модель-безопасности)
19. [Автоопределение параметров сцены](#19-автоопределение-параметров-сцены)
20. [Тестирование и сборка](#20-тестирование-и-сборка)
21. [История версий](#21-история-версий)

---

## 1. Быстрый старт

### 1.1 Готовый UI-компонент

```tsx
import { Sandbox } from 'browser-tsx-sandbox';

<Sandbox
  config={{
    code: `export default function Scene() { return <div>Hello</div>; }`,
    assets: { 'logo.png': blobUrl },
    renderLoading: () => <Spinner />,
    renderError: ({ error, isRuntime }) => <pre>{error.message}</pre>,
    onCompiled: ({ executionTimeMs }) => console.log(executionTimeMs),
  }}
/>
```

### 1.2 Императивный фасад

```ts
import { SandboxFacade } from 'browser-tsx-sandbox';

const facade = new SandboxFacade({ react: React });
facade.setAssets({ 'clip.mp4': blobUrl });
const { component, error, errorPhase } = await facade.compile(tsxSource);
```

### 1.3 Работа с файлами (VFS)

```tsx
<Sandbox
  config={{
    files: {
      '/Button.tsx': `export const Button = () => <button>Click</button>;`,
      '/App.tsx': `
        import { Button } from './Button';
        export default () => <div><Button /></div>;
      `,
    },
    entry: '/App.tsx',
  }}
/>
```

---

## 2. Карта публичного API

| Экспорт | Назначение |
|---|---|
| `SandboxFacade` | оркестратор компиляции/исполнения |
| `useLiveSandbox` | React-хук с debounce/abort |
| `Sandbox` | готовый UI-компонент |
| `SandboxErrorBoundary` | изоляция ошибок рендера |
| `PlayerSandbox` (subpath) | живой Remotion-плеер + headless-примитивы |
| `compileTsx`, `SucraseCompilerAdapter` | транспиляция TSX → CJS |
| `scanImports`, `extractBareImports`, `resolveVfsPath`, `stripComments` | анализ импортов |
| `loadMissingModules`, `defaultCdnResolver`, `defaultImporter` | загрузка npm с CDN |
| `ModuleCache` | реестр модулей + IndexedDB |
| `executeComponent`, `getShadowedGlobals` | исполнение в изолированной области |
| `injectLoopProtection` | защита от бесконечных циклов |
| `WorkerCompilerAdapter`, `createCompilerWorker` | компиляция в Web Worker |
| `getSandboxTypeDefinitions` | `.d.ts` для Monaco/CodeMirror |
| `extractAssetZip`, `createAssetUrlMap`, `releaseAssetUrls` | ZIP-ассеты |
| `MusicLayer`, `SFXLayer`, `TrackLayer`, `useActiveCues` | Data-Driven Timeline |
| `takeContainerSnapshot`, `createRemotionWatchdog`, `cleanupCanvasWebGl` | надёжность плеера |
| `exportBrowserVideo`, `downloadExportBlob`, `supportsBrowserExport` | MP4/WebM-экспорт через WebCodecs + `mediabunny` |
| `SafeZonesOverlay` | оверлеи safe zones (в экспорт/снимок не попадают) |
| `PlayerContext`, `usePlayerContext` | состояние плеера |
| `logger`, `configureLogger` | реактивный логгер (debug/info/warn/error) |

---

## 3. `SandboxFacade`

```ts
class SandboxFacade {
  constructor(
    initialRegistry?: ModuleRegistry,
    importerOrOptions?: ModuleImporter | SandboxFacadeOptions,
  );

  setAssets(assets: Record<string, string>): void;
  registerModule(name: string, module: unknown): void;
  compile(input: string | VirtualFileSystem, options?: CompileOptions): Promise<EvaluationResult>;
}
```

### 3.1 `SandboxFacadeOptions`

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `compiler` | `CompilerAdapter` | Sucrase | свой транспилятор (SWC/Babel) |
| `cdnResolver` | `CdnResolver` | `esm.sh` | URL пакета по имени |
| `importer` | `ModuleImporter` | нативный `import()` | своя загрузка модуля |
| `loopProtect` | `boolean` | `true` | защита от бесконечных циклов |
| `maxIterations` | `number` | `500_000` | лимит итераций |
| `plugins` | `(PipelinePlugin \| SandboxPlugin)[]` | `[]` | middleware до/после компиляции + onResolve/onLoad виртуальные модули |

```ts
const facade = new SandboxFacade(
  { react: React, remotion: Remotion },
  { cdnResolver: (pkg) => `https://esm.sh/${pkg}?external=react` },
);
```

### 3.2 `compile(input, options)`

| Аргумент | Тип | Описание |
|---|---|---|
| `input` | `string \| VirtualFileSystem` | одиночный код или карта файлов |
| `options.signal` | `AbortSignal` | отмена компиляции |
| `options.entry` | `string` | точка входа VFS (по умолчанию `/App.tsx`) |

Возвращает `EvaluationResult`:

```ts
interface EvaluationResult<T = any> {
  component: T | null;
  error: Error | null;
  executionTimeMs: number;
  errorPhase?: 'compiler' | 'security' | 'network' | 'runtime' | 'timeout';
}
```

### 3.3 Пайплайн `compile`

1. `plugins[].beforeCompile` для каждого файла;
2. `injectLoopProtection` (если включено);
3. `extractBareImports` → `loadMissingModules`;
4. транспиляция (`compiler` или `compileTsx`);
5. `plugins[].afterCompile`;
6. `executeComponent` в изолированной области.

---

## 4. `useLiveSandbox`

```ts
function useLiveSandbox(
  codeOrFiles: string | VirtualFileSystem,
  initialModules?: ModuleRegistry,   // {} (react добавляется сам)
  localAssets?: Record<string, string>, // {}
  options?: UseLiveSandboxOptions,
): UseLiveSandboxResult;
```

### 4.1 `UseLiveSandboxOptions`

Расширяет `SandboxFacadeOptions`:

| Поле | Тип | Описание |
|---|---|---|
| `debounceMs` | `number` | задержка перед компиляцией (Monaco/CodeMirror) |
| `entry` | `string` | точка входа VFS |
| `onError` | `(error: Error) => void` | колбэк ошибки компиляции/загрузки |
| `onCompiled` | `(info: CompiledComponentInfo) => void` | успешная компиляция |

### 4.2 `UseLiveSandboxResult`

```ts
interface UseLiveSandboxResult {
  Component: React.ComponentType<any> | null;
  error: Error | null;
  isCompiling: boolean;
  runtimeError: RuntimeRenderError | Error | null;
  setRuntimeError: (error: RuntimeRenderError | Error | null) => void;
}
```

```tsx
const { Component, error, isCompiling } = useLiveSandbox(code, { remotion: Remotion }, assets, {
  debounceMs: 250,
  onCompiled: ({ executionTimeMs }) => console.log(executionTimeMs),
});
```

Устаревшие компиляции отменяются автоматически через `AbortController`.

---

## 5. `<Sandbox>`

```ts
interface SandboxConfig extends UseLiveSandboxOptions {
  code?: string;
  files?: VirtualFileSystem;
  modules?: ModuleRegistry;
  assets?: Record<string, string>;
  mediaResolver?: (src: string) => string;
  className?: string;
  style?: React.CSSProperties;
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
  render?: (context: SandboxRenderContext) => React.ReactNode;
  renderLoading?: (context: SandboxRenderContext) => React.ReactNode;
  renderError?: (context: SandboxErrorContext) => React.ReactNode;
}
```

```ts
interface SandboxRenderContext {
  Component: React.ComponentType<any> | null;
  error: Error | null;
  isCompiling: boolean;
}

interface SandboxErrorContext extends SandboxRenderContext {
  error: Error;
  isRuntime?: boolean;
}
```

- `code` и `files` взаимоисключающие; `files` имеет приоритет.
- Ошибки рендера ловит встроенный [`SandboxErrorBoundary`](#151-sandboxerrorboundary).
- Если заданы `className`/`style`, контент оборачивается в `<div data-tsx-sandbox>`.

### 5.1 `mediaResolver` — перехват медиа-ассетов без правки кода сцены

Иногда код сцены содержит прямые локальные пути (например `C:\Users\...\clip.mp4`), а
браузер блокирует их загрузку («Not allowed to load local resource»). `mediaResolver`
прозрачно оборачивает медиа-компоненты Remotion (`OffthreadVideo`, `Video`, `Audio`,
`Img`) из переданного модуля `remotion` и при каждом рендере подменяет их проп `src`
результатом вызова; сам исходный код сцены не меняется.

| Поле | Тип | По умолчанию |
|---|---|---|
| `mediaResolver` | `(src: string) => string` | — (патч не применяется) |

**Пример А — локальная разработка через Vite** (отдаём файлы прямо с диска через
`/@fs/`; в `demo/vite.config.ts` должен быть задан `server: { fs: { strict: false } }`):

```tsx
<PlayerSandbox
  config={{
    code: sceneCode,
    modules: { remotion: Remotion },
    mediaResolver: (src) => {
      const clean = src.replace(/^file:\/\/\//i, '');
      if (/^[a-zA-Z]:[\\/]/.test(clean)) {
        return '/@fs/' + clean.replace(/\\/g, '/');
      }
      return src;
    },
  }}
/>
```

**Пример Б — файлы из ZIP/памяти браузера** (в коде сцены остаются абсолютные пути,
а в рантайме берутся blob-ссылки из `assets`):

```tsx
const zipAssets = {
  'clip_0000_0004.mp4': 'blob:http://localhost/...',
};

<PlayerSandbox
  config={{
    code: userCode,
    assets: zipAssets,
    mediaResolver: (src) => {
      const filename = src.split(/[\\/]/).pop()!;
      return zipAssets[filename] ?? src;
    },
  }}
/>
```

Работает во всех UI-компонентах (`<Sandbox>`, `<PlayerSandbox>`), т.к. поле объявлено
в общем `SandboxConfig`. Другие экспорты модуля `remotion` (хелперы, хуки, константы)
обёртка не затрагивает; рефы пробрасываются через `forwardRef`.

---

## 6. `<PlayerSandbox>`

Импортируется из subpath `browser-tsx-sandbox/player` — так `@remotion/player` не попадает в основной бандл.

```tsx
import { PlayerSandbox } from 'browser-tsx-sandbox/player';

<PlayerSandbox
  ref={playerRef}
  config={{ code, durationInFrames: 300, fps: 30, width: 1920, height: 1080, controls: true }}
/>
```

### 6.1 `PlayerSandboxConfig`

Расширяет `SandboxConfig`:

| Поле | Тип | По умолчанию |
|---|---|---|
| `durationInFrames` | `number` | `300` |
| `fps` | `number` | `30` |
| `width` / `height` | `number` | `1920` / `1080` |
| `controls` | `boolean` | `true` (нативные контролы Remotion) |
| `loop` | `boolean` | — |
| `autoPlay` | `boolean` | — |
| `inputProps` | `Record<string, unknown>` | — |
| `playerProps` | `Partial<PlayerPropsWithoutZod<...>>` | escape hatch для `<Player />` |
| `smartFrameRetention` | `boolean` | `true` |
| `delayRenderTimeoutMs` | `number` | `4000` |
| `safeZone` | `SafeZonePreset \| SafeZonePreset[]` | — |
| `canvasControls` | `CanvasControlsConfig` | — |

```ts
interface CanvasControlsConfig {
  enabled?: boolean;
  minZoom?: number;   // 0.25
  maxZoom?: number;   // 4
  initialZoom?: number; // 1
}
```

В `PlayerSandboxConfig` доступны и все поля `SandboxConfig`, включая `mediaResolver` (см. [5.1](#51-mediarresolver--перехват-медиа-ассетов-без-правки-кода-сцены)) — для сцен с локальными путями к медиа.

### 6.2 `PlayerSandboxRef`

```ts
interface PlayerSandboxRef {
  seekTo: (frame: number) => void;
  getCurrentFrame: () => number;
  isPlaying: () => boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  takeSnapshot: (options?: SnapshotOptions) => Promise<string>;
  getActiveDelayHandles: () => string[];
  getRemotionPlayerRef: () => PlayerRef | null;
  resetZoomPan: () => void;
  exportVideo: (options?: ExportVideoOptions) => Promise<Blob | null>;
  getExportState: () => ExportState;
  abortExport: () => void;
}
```

```tsx
const png = await ref.current?.takeSnapshot({ format: 'image/png' });
ref.current?.seekTo(142);

const mp4 = await ref.current?.exportVideo({ filename: false, quality: 'high' });
const state = ref.current?.getExportState(); // { phase, progress, ... }
ref.current?.abortExport();
```

### 6.5 Программный экспорт видео

`exportVideo` рендерит плеер в MP4/WebM прямо в браузере (WebCodecs + мультиплексирование `mediabunny`)
и по умолчанию скачивает файл (`filename: false` — только вернуть `Blob`).

Захват кадра идёт в **реальном разрешении композиции** (по `config.width/height`,
без UI-масштаба), поэтому видео не размывается при апскейле для YouTube/Instagram.
В кадр попадает только сам компонент (`[data-remotion-canvas]`) — оверлеи safe zones,
аудио и видео-элементы в экспорт не попадают.

```ts
interface ExportVideoOptions {
  filename?: string | false; // false — вернуть Blob без загрузки
  codec?: 'avc' | 'vp8' | 'vp9'; // 'avc' — MP4 (по умолчанию)
  quality?: 'low' | 'medium' | 'high'; // 'high' (по умолчанию)
  bitrate?: number; // бит/с; приоритетнее quality
  width?: number;   // разрешение кадра; по умолчанию config.width (1920)
  height?: number;  // по умолчанию config.height (1080)
  fps?: number;     // частота; по умолчанию config.fps (30)
  onProgress?: (progress: ExportProgress) => void; // { phase, progress, renderedFrames, encodedFrames }
}
```

Прогресс и ошибки — в реактивном `exportState` из контекста плеера (плюс синхронный
`getExportState()` на рефе) и в логгере (`logger.info` — старт/финиш, `logger.debug` —
каждые 25 кадров).

### 6.3 Headless-примитивы (compound)

```tsx
<PlayerSandbox.Root config={config}>
  <PlayerSandbox.PlayButton />
  <PlayerSandbox.TimeDisplay format="both" />
  <PlayerSandbox.Timeline />
  <PlayerSandbox.VolumeControl />
  <PlayerSandbox.Guides preset="tiktok-9x16" />
</PlayerSandbox.Root>
```

### 6.4 Smart Frame Retention

При перекомпиляции кода сохраняются текущий кадр и состояние play: после появления нового компонента вызываются `player.seekTo(previousFrame)` и (если проигрывалось) `player.play()`.

---

## 7. Headless UI плеера

### 7.1 `PlayerContextValue`

```ts
interface PlayerContextValue {
  playerRef: RefObject<PlayerRef | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  currentFrame: number;
  durationInFrames: number;
  fps: number;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  zoom: number;
  pan: { x: number; y: number };
  seekTo: (frame: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  resetZoomPan: () => void;
  takeSnapshot: (options?: SnapshotOptions) => Promise<string>;
  exportState: ExportState;
  exportVideo: (options?: ExportVideoOptions) => Promise<Blob | null>;
  getExportState: () => ExportState;
  abortExport: () => void;
}
```

### 7.2 Примитивы и render props

| Компонент | Проп | Контекст |
|---|---|---|
| `PlayPauseButton` | `children`-функция | `{ isPlaying, toggle }` |
| `TimeDisplay` | `render` | `{ frame, totalFrames, time, totalTime, fps }` |
| `TimelineBar` | `render` | `{ currentFrame, durationInFrames, seekTo }` |
| `VolumeControl` | `render` | `{ volume, isMuted, setVolume, toggleMute }` |
| `ExportButton` | `children`-функция | `{ isExporting, supported, progress, error, exportVideo, cancel }` |

```tsx
<PlayerSandbox.PlayButton>
  {({ isPlaying, toggle }) => (
    <button onClick={toggle}>{isPlaying ? 'Pause' : 'Play'}</button>
  )}
</PlayerSandbox.PlayButton>

<PlayerSandbox.Timeline
  render={({ currentFrame, durationInFrames, seekTo }) => (
    <input type="range" min={0} max={durationInFrames} value={currentFrame}
      onChange={(e) => seekTo(Number(e.target.value))} />
  )}
/>
```

- Без render prop примитив рендерит дефолтную разметку.
- `PlayPauseButton` также принимает стандартные атрибуты `<button>`.
- `TimeDisplay` поддерживает `format: 'frames' | 'time' | 'both'`.
- Экспортируемые типы: `PlayPauseButtonProps`, `PlayPauseButtonRenderProps`, `TimeDisplayProps`, `TimeDisplayRenderProps`, `TimelineBarProps`, `TimelineBarRenderProps`, `VolumeControlProps`, `VolumeControlRenderProps`.

### 7.3 `usePlayerContext`

```tsx
import { usePlayerContext } from 'browser-tsx-sandbox/player';

function ExternalSeeker() {
  const { seekTo, durationInFrames, isPlaying, play, pause } = usePlayerContext();
  return (
    <>
      <button onClick={() => seekTo(0)}>Начало</button>
      <button onClick={() => seekTo(durationInFrames / 2)}>Середина</button>
      <button onClick={isPlaying ? pause : play}>{isPlaying ? 'Pause' : 'Play'}</button>
    </>
  );
}
```

> Компонент с `usePlayerContext` обязан находиться внутри `PlayerSandbox.Root`, иначе будет выброшена ошибка.

---

## 8. Data-Driven Timeline

Слои описываются JSON-массивом `Cue` и обновляются через `inputProps` без перекомпиляции TSX.

### 8.1 `Cue<T>` и `AudioPayload`

```ts
interface Cue<T = Record<string, unknown>> {
  id: string | number;
  type: string;               // 'music' | 'sfx' | 'voice' | 'caption' | 'sticker' | ...
  startFrame: number;
  durationInFrames?: number;  // undefined = до конца композиции
  payload: T;
}

interface AudioPayload {
  src: string;
  volume?: number;
  playbackRate?: number;
}

type SFXPayload = AudioPayload;
```

### 8.2 `useActiveCues`

```ts
function useActiveCues<T>(cues: Cue<T>[], type?: string): Cue<T>[];
```

Возвращает события, активные на текущем кадре (`startFrame <= frame < startFrame + durationInFrames`).

### 8.3 `SFXLayer`

```ts
function SFXLayer(props: { cues: Cue<AudioPayload>[]; globalVolume?: number }): JSX.Element;
```

`globalVolume` (по умолчанию `1`) применяется к событиям без `payload.volume`.

```tsx
<SFXLayer cues={cues} globalVolume={0.9} />
```

### 8.4 `MusicLayer` (Audio Ducking)

```ts
function MusicLayer(props: {
  cues: Cue<AudioPayload>[];
  volumeDucking?: (frame: number) => number;
}): JSX.Element;
```

`volume` трека = `payload.volume * volumeDucking(frame)`. Remotion принимает функцию в `volume`, поэтому приглушение плавное.

```tsx
<MusicLayer cues={cues} volumeDucking={(f) => (f >= 60 && f <= 180 ? 0.15 : 1)} />
```

### 8.5 `TrackLayer`

```ts
function TrackLayer<T>(props: {
  cues: Cue<T>[];
  type: string;
  renderCue: (cue: Cue<T>) => ReactNode;
}): JSX.Element;
```

```tsx
<TrackLayer cues={cues} type="sticker" renderCue={(c) => <Sticker {...c.payload} />} />
```

### 8.6 Интеграция с редактором (`inputProps`)

```tsx
import * as Remotion from 'remotion';
import * as Timeline from 'browser-tsx-sandbox';
import { PlayerSandbox } from 'browser-tsx-sandbox/player';

const [cues, setCues] = useState<Cue[]>([]);

<PlayerSandbox
  config={{
    code: SCENE_TSX,               // не меняется
    modules: { remotion: Remotion, 'browser-tsx-sandbox': Timeline },
    inputProps: { cues },          // сцена получает cues как пропсы
    durationInFrames: 300,
    fps: 30,
  }}
/>
```

Сцена: `export default function Scene({ cues = [] }) { ... }`. Изменение `cues` обновляет кадр без компиляции.

### 8.7 Готовые примеры

- `examples/data-driven-timeline.tsx` — все слои из одного массива.
- `examples/voiceover-animation.tsx` — реальная озвучка + музыка с ducking + SFX.
- Рендеры: `npm run render:timeline`, `npm run render:voiceover`.

---

## 9. Компилятор

> 📖 Практический гайд по плагинам (Tailwind JIT + свои расширения) — [`docs/plugins.md`](./docs/plugins.md).

### 9.1 `compileTsx`

```ts
function compileTsx(code: string, filename?: string): string; // 'component.tsx'
```

Транспилирует TSX в CommonJS (`React.createElement`), вырезает типы и снимает markdown-обрамление (блоки в трёх обратных кавычках, которые возвращают LLM).

При ошибке бросает `CompilerError` с `line`, `column`, `snippet`.

### 9.2 `cleanMarkdownFences`

```ts
function cleanMarkdownFences(code: string): string;
```

Удаляет обрамление ```tsx ... ``` из ответов LLM.

### 9.3 `SucraseCompilerAdapter`

```ts
class SucraseCompilerAdapter implements CompilerAdapter {
  readonly name = 'sucrase';
  transform(code: string, filepath?: string): string;
}
```

### 9.4 Анализ импортов

```ts
function scanImports(code: string): ScanResult;
function extractBareImports(code: string): string[];
function stripComments(code: string): string;
function resolveVfsPath(currentFile: string, relativePath: string, vfs: VirtualFileSystem): string | null;

interface ScanResult {
  bareImports: string[];     // 'react', 'framer-motion'
  localImports: string[];    // './Button'
  dynamicImports: string[];  // import('...')
}
```

`resolveVfsPath` подбирает расширения (`.tsx/.ts/.jsx/.js/.json`) и `index.*`.

---

## 10. Library Manager (CDN)

### 10.1 `loadMissingModules`

```ts
function loadMissingModules(
  packages: string[],
  cache: ModuleCache,
  importerOrOptions?: ModuleImporter | LoadModulesOptions,
): Promise<void>;

interface LoadModulesOptions {
  importer?: ModuleImporter;
  cdnResolver?: CdnResolver;
  signal?: AbortSignal;
}

const defaultCdnResolver: CdnResolver = (pkg) => `https://esm.sh/${pkg}`;
```

Ошибка загрузки → `NetworkModuleError` с именем пакета.

### 10.2 `ModuleCache`

```ts
class ModuleCache {
  constructor(initialModules?: ModuleRegistry);
  register(name: string, module: unknown): void;
  get(name: string): unknown;
  getAll(): ModuleRegistry;
  has(name: string): boolean;
  clear(): void;
  loadFromIndexedDb(key: string): Promise<string | null>;
  saveToIndexedDb(key: string, value: string): Promise<void>;
}
```

### 10.3 Загрузка в разных средах

- **Браузер:** нативный `import('https://esm.sh/<pkg>')`; React-библиотеки оставляют `react` внешним.
- **Node:** нативные `https`-импорты не поддерживаются — используется адаптер с `?bundle`.

---

## 11. Исполнение и изоляция

### 11.1 `executeComponent`

```ts
function executeComponent(
  compiledEntryCode: string,
  contextOrRegistry: ModuleRegistry | EvaluatorContext,
  optionalGlobals?: SandboxGlobals,
): any;

interface EvaluatorContext {
  registry: ModuleRegistry;
  globals: SandboxGlobals;
  vfs?: VirtualFileSystem;
  compiledVfs?: Record<string, string>;
  entryPath?: string;
}
```

Код выполняется через `new Function` с внедрёнными `require`, `exports`, `React` и глобалами.

### 11.2 `getShadowedGlobals`

```ts
function getShadowedGlobals(): { forbiddenKeys: string[]; shadowValues: undefined[] };
```

Затеняет `window`, `document`, `localStorage`, `sessionStorage`, `fetch`, `XMLHttpRequest`, `indexedDB`, `navigator`, `WebSocket`.

### 11.3 `injectLoopProtection`

```ts
function injectLoopProtection(code: string, maxIterations?: number): string; // 500_000
```

Оборачивает циклы счётчиком; при превышении — `ExecutionTimeoutError`.

---

## 12. Ассеты и ZIP

```ts
type AssetArchive = Record<string, Uint8Array>;

function extractAssetZip(zip: Uint8Array): AssetArchive;
function createAssetUrlMap(
  archive: AssetArchive,
  createUrl: (bytes: Uint8Array, filename: string) => string,
): Record<string, string>;
function releaseAssetUrls(urls: Record<string, string>, revoke: (url: string) => void): void;
```

```ts
const archive = extractAssetZip(zipBytes);
const urls = createAssetUrlMap(archive, (bytes) => URL.createObjectURL(new Blob([bytes])));
facade.setAssets(urls);                 // staticFile('logo.png') → blob:
releaseAssetUrls(urls, URL.revokeObjectURL);
```

> `createAssetUrlMap` берёт basename: `assets/logo.png` → `staticFile('logo.png')`.

---

## 13. Аудио и видео-пайплайн

Песочница не содержит отдельного аудио-движка: микширование делает Remotion `<Audio />`, а песочница доставляет ассеты через мост `assets → blob: → staticFile()`.

```tsx
import { Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export default function Scene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bgmVolume = interpolate(frame, [45, 60, 180, 195], [0.8, 0.15, 0.15, 0.8],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <>
      <Audio src={staticFile('bgm.mp3')} volume={bgmVolume} />
      <Sequence from={60} durationInFrames={120}>
        <Audio src={staticFile('voice.mp3')} volume={1} />
      </Sequence>
    </>
  );
}
```

- Форматы: MP3/WAV/OGG; в рендере результат — H.264 + AAC.
- Ассет можно передать как `blob:` (файл пользователя) или `http` (CDN).
- `MusicLayer` + `volumeDucking` — декларативный вариант ducking'а (см. [раздел 8](#8-data-driven-timeline)).

---

## 14. Рендер-харнесс

Офлайн-рендер (Node + headless Chrome) на эталонных интеграциях из `render/`.

| Скрипт | Ассеты | Результат |
|---|---|---|
| `render` | — | `frame-30.png`, `sandbox.mp4` |
| `render:assets` | ZIP → public | `asset-still.png`, `asset-video.mp4` |
| `render:example` | локальные mp4 | кадры + `example-map.mp4` |
| `render:widgets` | JSON-каталог | кадры + mp4 по виджетам |
| `render:props` | вариации пропсов | проверка, что пропсы меняют рендер |
| `render:cdn` | esm.sh (d3/three) | `cdn-libs.png/mp4` |
| `render:showcase` | Tailwind + lucide + d3/three | `showcase-frame-*.png`, `showcase.mp4` |
| `render:audio` | генерируемые WAV | `audio-ducking.mp4` |
| `render:animation` | скачиваемые музыка/SFX | `sound-motion.mp4` |
| `render:timeline` | скачиваемые музыка/SFX | `data-driven-timeline.mp4` |
| `render:voiceover` | `examples/voice/voice_01.wav` | `voiceover-animation.mp4` |

---

## 15. Вспомогательные утилиты

### 15.1 `SandboxErrorBoundary`

```ts
interface SandboxErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
  onError?: (error: Error) => void;
  resetKey?: unknown;
}
```

Известные ошибки песочницы (`timeout`/`security`) пробрасываются как есть, остальные оборачиваются в `RuntimeRenderError`.

### 15.2 `takeContainerSnapshot`

```ts
function takeContainerSnapshot(container: HTMLElement | null, options?: SnapshotOptions): Promise<string>;

interface SnapshotOptions {
  format?: 'image/png' | 'image/jpeg' | 'image/webp'; // 'image/png'
  quality?: number; // 0.95
  targetWidth?: number;   // 1920
  targetHeight?: number;  // 1080
}
```

Порядок: `<canvas>` → DOM-растеризация (`foreignObject` с инъекцией CSS страницы)
→ SVG data-URL (если canvas *tainted*).

Снимок снимает **только композицию**: из клона вырезаются элементы с
`data-sandbox-overlay`, `data-testid="safe-zones-overlay"`, `.safe-zone-overlay`
и все `<audio>/<video>`, а размер принудительно приводится к `targetWidth × targetHeight`
(точный 1:1 кадр для Instagram/TikTok).

### 15.3 `createRemotionWatchdog`

```ts
function createRemotionWatchdog(
  remotionModule: unknown,
  timeoutMs?: number, // 4000
  onTimeout?: (label?: string, handleId?: number) => void,
): WatchdogResult;

interface WatchdogResult {
  proxiedRemotion: any;
  getActiveHandles: () => WatchdogHandleInfo[];
  clearAllTimeouts: () => void;
}

interface WatchdogHandleInfo {
  id: number;
  label?: string;
  createdAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
}
```

Снимает `delayRender` без `continueRender` по таймауту (с warning).

### 15.4 `cleanupCanvasWebGl`

```ts
function cleanupCanvasWebGl(container: HTMLElement | null): number;
```

Высвобождает WebGL-контексты (`WEBGL_lose_context`) — защита от `Too many active WebGL contexts`.

### 15.5 `SafeZonesOverlay`

```ts
type SafeZonePreset =
  | 'tiktok-9x16' | 'reels-9x16' | 'shorts-9x16'
  | 'tv-safe-16x9' | 'rule-of-thirds' | 'center-cross';

interface SafeZonesOverlayProps {
  preset?: SafeZonePreset | SafeZonePreset[]; // все пресеты 9×16 можно передать массивом
  color?: string;             // 'rgba(255, 255, 255, 0.45)'
  style?: CSSProperties;
  className?: string;
}
```

- Координаты считаются в сетке **1080×1920** (`viewBox="0 0 1080 1920"`), поэтому
  разметка совпадает 1:1 с экспортом: TikTok 220/200/480, Reels 220/180/440,
  Shorts 140/200/340, TV-safe 54/96 (10%/5%) и 108/192, правило третей, центральный крест.
- Оверлей помечен `data-sandbox-overlay="true"` — `takeContainerSnapshot` и экспорт
  **вырезают его из кадра**.

### 15.8 `logger` / `configureLogger`

```ts
function configureLogger(options: { enabled?: boolean; level?: 'debug' | 'info' | 'warn' | 'error' }): void;

const logger: {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
};
```

Глобальный (по умолчанию выключенный) логгер. Используется снимком, экспортом
и плеером; в проде отключается — `enabled: false` убирает вывод насовсем.

### 15.6 `getSandboxTypeDefinitions`

```ts
function getSandboxTypeDefinitions(): { filename: string; content: string }[];
```

`.d.ts` для автодополнения глобалов песочницы в Monaco/CodeMirror.

```ts
getSandboxTypeDefinitions().forEach(({ filename, content }) =>
  monaco.languages.typescript.typescriptDefaults.addExtraLib(content, filename),
);
```

### 15.7 `WorkerCompilerAdapter`

```ts
function createCompilerWorker(): Worker | null;

class WorkerCompilerAdapter implements CompilerAdapter {
  readonly name = 'worker-sucrase';
  constructor(worker?: Worker | null);
  get isWorker(): boolean;
  transform(code: string, filepath?: string): Promise<string>;
  dispose(): void;
}
```

Без `Worker` (Node/SSR/jsdom) прозрачно компилирует на главном потоке.

---

## 16. Базовые типы

```ts
type ModuleRegistry = Record<string, any>;
type VirtualFileSystem = Record<string, string>;
type CdnResolver = (pkg: string) => string;

interface SandboxGlobals {
  staticFile: (filename: string) => string;
  [key: string]: any;
}

interface CompilerAdapter {
  name: string;
  transform(code: string, filepath: string): Promise<string> | string;
}

interface LoopProtectOptions {
  enabled?: boolean;
  maxIterations?: number;
}

interface CompileOptions {
  signal?: AbortSignal;
  entry?: string;
  files?: VirtualFileSystem;
}

interface PipelinePlugin {
  name: string;
  beforeCompile?: (code: string, filepath: string) => string | Promise<string>;
  afterCompile?: (compiledJs: string, filepath: string) => string | Promise<string>;
}

interface SandboxPlugin {
  name: string;
  setup(build: PluginBuild): void | Promise<void>;
}

interface PluginBuild {
  onResolve(
    options: { filter: RegExp; namespace?: string },
    callback: (args: OnResolveArgs) => OnResolveResult | null,
  ): void;
  onLoad(
    options: { filter: RegExp; namespace?: string },
    callback: (args: OnLoadArgs) => OnLoadResult | null,
  ): void;
}

const DEFAULT_ENTRY = '/App.tsx';
const DEFAULT_MAX_ITERATIONS = 500_000;
```

---

## 17. Ошибки

```ts
type ErrorPhase = 'compiler' | 'security' | 'network' | 'runtime' | 'timeout';
```

| Класс | `name` | Поля |
|---|---|---|
| `CompilerError` | `CompilerError` | `line`, `column`, `snippet` |
| `SecurityError` | `SecurityError` | — |
| `NetworkModuleError` | `NetworkModuleError` | `moduleName` |
| `ExecutionTimeoutError` | `ExecutionTimeoutError` | `limit` |
| `RuntimeRenderError` | `RuntimeRenderError` | `componentStack`, `cause` |

```ts
function getErrorPhase(error: unknown): ErrorPhase;
function isExecutionTimeoutError(error: unknown): boolean;
function isSandboxPassthroughError(error: unknown): boolean;
```

---

## 18. Модель безопасности

### Что даёт песочница

- Затенение опасных глобалов (`window`, `document`, `fetch`, `localStorage`, `navigator`, `WebSocket`, …).
- Запрет импорта неразрешённых модулей (только реестр/CDN).
- Прерывание бесконечных циклов (`ExecutionTimeoutError`).
- Изоляция ошибок рендера через ErrorBoundary.

### Чего песочница НЕ гарантирует

- Это **не** изоляция уровня ОС: код исполняется в том же JS-realm (`new Function`).
- Определённые вычисления всё ещё могут нагрузить вкладку (например, тяжёлый WebGL).
- Загруженные npm-пакеты выполняются с теми же правами.

### Рекомендации

- Не исполняйте полностью недоверенный код без дополнительного sandbox (iframe/Worker с CSP).
- Ограничивайте `maxIterations` и используйте `AbortSignal`.
- Отдавайте пользователю только нужный набор модулей.

---

## 19. Автоопределение параметров сцены

При использовании `<PlayerSandbox config={{ code: '...' }} />` без явно указанных `durationInFrames`/`fps`/`width`/`height`/`inputProps` библиотека **автоматически извлекает** их из содержимого TSX/JSON.

### Как это работает

`<PlayerSandbox>` вызывает `extractSceneMetadata()` при каждой компиляции и передаёт
параметры в `@remotion/player`. Если в `config` указаны явные пропсы — они переопределяют
значения извлечённые из кода (приоритет: **config > metadata > дефолт**).

### Источники (в порядке приоритета)

| # | Источник | Что извлекается |
|---|---|---|
| 1 | `export const compositionConfig = { … }` (или `config`, `sceneConfig`, `metadata`) | `id`, `durationInFrames`/`durationFrames`, `fps`, `width`, `height`, `defaultProps`/`inputProps` |
| 2 | `export const durationInFrames = …`, `export const fps = …` и т.д. | Прямые именованные экспорт-значения |
| 3 | `Scene.durationInFrames = …`, `Scene.defaultProps = { … }` (статика компонента) | Статические поля функции |
| 4 | `<Composition id="…" durationInFrames={…} fps={…} width={…} height={…} />` в тексте кода | Regex fallback (строка, `<Composition/>`) |
| 5 | JSON: `{"durationInFrames":…}` или Vidora-каталог (`widgets[0]`) | Прямой JSON, `id` → ориентация (`*9x16` → 1080×1920, `*16x9` → 1920×1080), `default_props.durationFrames` → `durationInFrames` |

### Примеры

**export const compositionConfig:**
```tsx
// Нет пропсов — всё берётся из кода
<PlayerSandbox config={{ code: `
  export const compositionConfig = {
    id: 'Reel',
    durationInFrames: 240,
    fps: 60,
    width: 1080,
    height: 1920,
    defaultProps: { title: 'Привет', color: '#fff' },
  };
  export default function Scene({ title }: any) { return <div>{title}</div>; }
` }} />
```

**Отдельные export const:**
```tsx
<PlayerSandbox config={{ code: `
  export const durationInFrames = 90;
  export const fps = 24;
  export const width = 1280;
  export const height = 720;
  export default function Scene() { return <div>Scene</div>; }
` }} />
```

**Статические поля компонента:**
```tsx
<PlayerSandbox config={{ code: `
  export default function Scene() { return <div>Scene</div>; }
  Scene.durationInFrames = 150;
  Scene.fps = 25;
  Scene.width = 480;
  Scene.height = 854;
` }} />
```

**Regex fallback — `<Composition>` в строке:**
```tsx
<PlayerSandbox config={{ code: `
  const template = '<Composition id="Tag" durationInFrames={99} fps={12} width={640} height={360} />';
  export default function Scene() { return <div>Scene</div>; }
` }} />
```

**JSON / Vidora-каталог:**
```tsx
<PlayerSandbox config={{
  files: {
    '/widgets.json': JSON.stringify({
      widgets: [{
        id: 'WordByWordText9x16',      // 9x16 → 1080×1920
        default_props: {
          durationFrames: 300,
          title: 'Заголовок',
        },
      }],
    }),
    '/App.tsx': 'export default function Scene() { return <div />; }',
  },
  entry: '/App.tsx',
}} />
```

### Доступ к метаданным из кода

```ts
import { extractSceneMetadata } from 'browser-tsx-sandbox';

const metadata = extractSceneMetadata(codeString, evaluatedExports, Component);
// metadata.durationInFrames, metadata.fps, metadata.width, metadata.height, metadata.defaultProps
```

### Дефолтные значения (когда извлечь нечего)

| Параметр | Дефолт |
|---|---|
| `durationInFrames` | `300` |
| `fps` | `30` |
| `width` | `1920` |
| `height` | `1080` |

---

## 20. Тестирование и сборка

| Скрипт | Действие |
|---|---|
| `test` | `vitest run` — юнит-тесты |
| `test:watch` | vitest в режиме наблюдения |
| `test:e2e` | реальный рендер в Chrome (`vitest.e2e.config.ts`) |
| `test:network` | загрузка библиотек с esm.sh |
| `typecheck` | `tsc --noEmit` |
| `build` | `tsup` → `dist/` (ESM + CJS + `.d.ts`) |
| `pack:check` | `npm pack --dry-run` |
| `verify:video` | разбор MP4 (кодек, размеры, длительность) |
| `arch` | проверка модульной архитектуры (`scripts/verify-architecture.mjs`) |

В публикацию входят `dist/`, `README.md`, `API.md`. `react` — peer, `sucrase`/`fflate` — deps, `@remotion/player`/`remotion` — optional peer.

---

## 21. История версий

### v0.8.0
- **Scene Metadata:** автоматическое извлечение `durationInFrames`/`fps`/`width`/`height`/`defaultProps` из
  `compositionConfig`/`config`/`sceneConfig`/`metadata` экспортов, статики компонента, `<Composition>` в коде и JSON (прямой + Vidora `widgets[]`). Deafults для JSON-сцен: 300 кадров, 30 fps, 1080×1920. `<PlayerSandbox>` применяет metadata-фолбэки если пропсы не указаны.
- **Чистый кадр для вертикальных платформ:** снимок/экспорт пишут только композицию
  (`data-remotion-canvas`, точный 1:1 без UI-масштаба); safe-zone оверлеи, `<audio>/<video>`
  вырезаются из кадра, CSS страницы инъектируется в `foreignObject`.
- **Safe zones:** `SafeZonesOverlay` пересчитан в сетке 1080×1920 с реальной геометрией
  TikTok/Reels/Shorts/TV-safe/правила третей/креста.
- **Программный экспорт:** `ExportVideoOptions.width/height/fps/onProgress`,
  `PlayerSandboxRef.getExportState()`, `PlayerContextValue.getExportState()`.
- **Логгер:** `configureLogger`/`logger` для плеера, снимка и экспорта (по умолчанию выкл).

### v0.6.0
- **Плеер:** стабильный `SafeComponent` (без ре-маунта `<Player />`), явные `width/height: 100%` для контейнера и плеера, headless-UI не размонтируется при компиляции/ошибках.
- **Subpath `./export`:** MP4/WebM-экспорт кадра/видео через WebCodecs + `mediabunny` (`browser-tsx-sandbox/export`).
- **Subpath `./plugins`:** Tailwind JIT-плагин (`browser-tsx-sandbox/plugins`).
- **Subpath `./hmr`:** инкрементальная перекомпиляция VFS, HMR без полного сброса (`browser-tsx-sandbox/hmr`).
- **Фичи-пайплайн:** `render/features.e2e.test.ts` — E2E-рендер новых сцен, `render:features`.

### v0.5.0
- **Audio:** музыка, озвучка, SFX через Remotion `<Audio />`; Audio Ducking.
- **Data-Driven Timeline:** `Cue`, `useActiveCues`, `MusicLayer`, `SFXLayer`, `TrackLayer`.
- **Headless Render Props:** `PlayPauseButton` / `TimeDisplay` / `TimelineBar` / `VolumeControl`.
- **Пакет:** `remotion` — optional peerDependency и `external` в tsup.

### v0.4.0
- **Студия:** Smart Frame Retention, `PlayerSandboxRef`, `takeContainerSnapshot`, safe zones, canvas zoom/pan, delayRender watchdog, WebGL guard, headless compound UI.

### v0.3.0
- **VFS**, loop protection, ErrorBoundary, debounce + AbortSignal, pluggable CDN/компилятор, Web Worker компиляция, type definitions helper, pipeline-плагины, фазы ошибок.

### v0.1.0–0.2.0
- Базовый компилятор Sucrase, `<Sandbox>`/`<PlayerSandbox>`, живая загрузка библиотек с esm.sh.
