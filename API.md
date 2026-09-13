# 📚 API Reference — browser-tsx-sandbox

Максимально подробное описание публичных контрактов, сигнатур, типов и поведения пакета.

- [1. Назначение и область применения](#1-назначение-и-область-применения)
- [2. Установка и форматы модулей](#2-установка-и-форматы-модулей)
- [3. Карта модулей](#3-карта-модулей)
- [4. Публичный API (`src/index.ts`)](#4-публичный-api-srcindexts)
- [5. Базовые типы](#5-базовые-типы)
- [6. Ошибки](#6-ошибки)
- [7. `SandboxFacade`](#7-sandboxfacade)
- [8. `useLiveSandbox`](#8-uselivesandbox)
- [9. Compiler](#9-compiler)
- [10. Library Manager](#10-library-manager)
- [11. Sandbox (изоляция и выполнение)](#11-sandbox-изоляция-и-выполнение)
- [12. Assets (ZIP)](#12-assets-zip)
- [13. Интеграция с JSON-каталогом виджетов](#13-интеграция-с-json-каталогом-виджетов)
- [14. Рендер-харнесс (эталонная интеграция)](#14-рендер-харнесс-эталонная-интеграция)
- [15. Модель безопасности](#15-модель-безопасности)
- [16. Тестирование](#16-тестирование)
- [17. Совместимость и версии](#17-совместимость-и-версии)

---

## 1. Назначение и область применения

`browser-tsx-sandbox` — клиентская (Zero-Backend) среда, которая:

1. извлекает список NPM-зависимостей из сырого TSX;
2. подгружает отсутствующие библиотеки с CDN (`esm.sh`);
3. транспилирует TSX → CommonJS (`React.createElement`) через Sucrase;
4. выполняет код в изолированной области (`new Function`) с затенением опасных глобальных API;
5. возвращает готовый React-компонент для рендера (например, Remotion Player/Composition).

Пакет не зависит от Node.js и не требует серверной сборки бандлов. Тяжёлые e2e-сценарии рендера требуют Node.js и Chrome (см. §14).

---

## 2. Установка и форматы модулей

```bash
npm install browser-tsx-sandbox react sucrase
```

- **Формат:** ESM (`"type": "module"`), точка входа — `src/index.ts` (TypeScript-исходники; для публикации рекомендуется собрать в `dist`).
- **Peer dependencies:** `react >= 17`, `sucrase >= 3`.
- **Runtime dependencies:** `react`, `sucrase`, `fflate`.
- **Dev-only (для e2e-рендера):** `remotion`, `@remotion/bundler`, `@remotion/renderer`, `lucide-react`, `tailwindcss`, `postcss`.

---

## 3. Карта модулей

| Модуль | Файл | Ответственность |
|---|---|---|
| Core | `src/core/types.ts` | Общие типы и интерфейсы |
| Core | `src/core/errors.ts` | Классы ошибок |
| Compiler | `src/compiler/analyzer.ts` | Поиск bare-импортов |
| Compiler | `src/compiler/transform.ts` | Транспиляция TSX → CJS |
| Library Manager | `src/library-manager/cache.ts` | Реестр модулей |
| Library Manager | `src/library-manager/loader.ts` | Загрузка с CDN + нормализация ESM |
| Sandbox | `src/sandbox/scope.ts` | Список затеняемых глобалов |
| Sandbox | `src/sandbox/evaluator.ts` | `new Function` и `require` |
| Assets | `src/assets/zip.ts` | Распаковка ZIP и blob-URL |
| React | `src/react/useLiveSandbox.ts` | React-хук |
| Facade | `src/facade.ts` | Оркестратор |
| Entry | `src/index.ts` | Публичные экспорты |

---

## 4. Публичный API (`src/index.ts`)

```ts
export { SandboxFacade } from './facade';
export { useLiveSandbox } from './react/useLiveSandbox';

export { ModuleCache } from './library-manager/cache';
export { loadMissingModules } from './library-manager/loader';
export type { ModuleImporter } from './library-manager/loader';

export { extractBareImports } from './compiler/analyzer';
export { compileTsx } from './compiler/transform';

export { executeComponent } from './sandbox/evaluator';
export { getShadowedGlobals } from './sandbox/scope';

export { extractAssetZip, createAssetUrlMap, releaseAssetUrls } from './assets/zip';
export type { AssetArchive } from './assets/zip';

export * from './core/types';
export * from './core/errors';
```

---

## 5. Базовые типы

```ts
type ModuleRegistry = Record<string, any>;

interface SandboxGlobals {
  staticFile: (filename: string) => string;
  [key: string]: any;
}

interface EvaluationResult<T = any> {
  component: T | null;
  error: Error | null;
  executionTimeMs: number;
}
```

- `ModuleRegistry` — карта `имя пакета → модуль`, доступная внутри песочницы через `require(name)`.
- `SandboxGlobals.staticFile` — резолвер локальных ассетов: `assetsMap[filename] || ''`. Можно добавлять любые дополнительные глобалы (они становятся параметрами `new Function`).
- `EvaluationResult` — результат `SandboxFacade.compile`: при ошибке `component === null`, при успехе `error === null`.

---

## 6. Ошибки

```ts
class CompilerError extends Error {
  name = 'CompilerError';
  message.includes('[Compiler Error]: ');
}

class SecurityError extends Error {
  name = 'SecurityError';
  message.includes('[Security Violation]: ');
}

class NetworkModuleError extends Error {
  name = 'NetworkModuleError';
  message.includes(`[Network Error]: Не удалось загрузить пакет "${moduleName}". ${originalMessage}`);
}
```

| Класс | Когда возникает |
|---|---|
| `CompilerError` | Sucrase не смог разобрать/транспилировать TSX |
| `SecurityError` | код попытался импортировать модуль, которого нет в реестре |
| `NetworkModuleError` | не удалось подгрузить пакет с CDN |

Важно: `executeComponent` **не заворачивает** `SecurityError` в generic `[Runtime Error]` — ошибки безопасности сохраняют свой тип и доходят до вызывающего кода.

---

## 7. `SandboxFacade`

### 7.1 Конструктор

```ts
new SandboxFacade(initialRegistry?: ModuleRegistry, importer?: ModuleImporter)
```

| Параметр | Тип | Описание |
|---|---|---|
| `initialRegistry` | `ModuleRegistry` | Предрегистрированные модули (React, Remotion, lucide-react и т.п.). По умолчанию `{}`. |
| `importer` | `ModuleImporter` | Точка внедрения загрузчика для тестов / замены CDN. По умолчанию — динамический `import()` с `https://esm.sh/<pkg>`. |

Конструктор копирует `initialRegistry` в собственный `ModuleCache`. Внешний объект можно мутировать после — на песочницу это не влияет.

### 7.2 `setAssets`

```ts
setAssets(assets: Record<string, string>): void
```

Регистрирует карту `имя файла → URL` (обычно `blob:` из `URL.createObjectURL`). `staticFile(name)` внутри сцены вернёт `assets[name] ?? ''`.

### 7.3 `compile`

```ts
compile(rawTsx: string): Promise<EvaluationResult>
```

Последовательность шагов:

1. `extractBareImports(rawTsx)` — список внешних пакетов.
2. `loadMissingModules(packages, cache, importer)` — догрузка отсутствующих.
3. `compileTsx(rawTsx)` — TSX → CommonJS.
4. Формирование `globals = { staticFile }`.
5. `executeComponent(jsCode, cache.getAll(), globals)`.

Гарантии:

- Никогда не бросает — все ошибки возвращаются в `EvaluationResult.error`.
- `executionTimeMs` — измеренное через `performance.now()` (в Node доступно как глобал).
- Загруженные библиотеки кэшируются между вызовами (сеть не дёргается повторно).
- Если `rawTsx` импортирует уже предрегистрированный пакет (например, `react`), сеть не используется.

```ts
const facade = new SandboxFacade({ react: React });
facade.setAssets({ 'logo.png': 'blob:http://localhost/...' });

const { component, error, executionTimeMs } = await facade.compile(`
  import React from 'react';
  export default function Scene() { return <div>{staticFile('logo.png')}</div>; }
`);

if (error) console.error(error);
else renderToDom(component);
```

### 7.4 Возврат экспортов

`executeComponent` возвращает:

1. `exports.default`, если он truthy;
2. иначе — первый именованный экспорт (например, `export const Scene`);
3. иначе — `null`.

Это покрывает оба стиля: `export default Scene` и `export const Scene`.

---

## 8. `useLiveSandbox`

```ts
function useLiveSandbox(
  code: string,
  initialModules: ModuleRegistry,
  localAssets?: Record<string, string>,
): {
  Component: React.ComponentType<any> | null;
  error: Error | null;
  isCompiling: boolean;
}
```

| Параметр | Описание |
|---|---|
| `code` | TSX-строка для компиляции |
| `initialModules` | Предрегистрированные модули; `react` подставляется автоматически |
| `localAssets` | Карта `имя → blob:url` для `staticFile` |

Поведение:

- `SandboxFacade` создаётся один раз (`useRef`); `react` добавляется автоматически.
- Компиляция перезапускается при изменении `code` или содержимого ассетов.
- **`localAssets` не должен передаваться новым объектом каждый рендер без изменения содержимого** — хук сравнивает `JSON.stringify(localAssets)`, поэтому идентичность объекта безопасна.
- При размонтировании результат отбрасывается (`isMounted`-guard).
- Ошибки компиляции попадают в `error`, а не выбрасываются.

```tsx
function Preview({ code, assets }: { code: string; assets: Record<string, string> }) {
  const { Component, error, isCompiling } = useLiveSandbox(code, {});
  if (isCompiling) return <Spinner />;
  if (error) return <ErrorOverlay error={error} />;
  return Component ? <Component /> : null;
}
```

---

## 9. Compiler

### 9.1 `compileTsx`

```ts
function compileTsx(code: string): string
```

- Удаляет маркеры markdown-ограждений ```` ```tsx ```` / ```` ``` ````.
- Транспилирует `typescript`, `jsx`, `imports` с `jsxRuntime: 'classic'` (JSX → `React.createElement`).
- Импорты превращаются в `require(...)`, экспорты — в `exports.*`.
- Результат — строка CommonJS, исполняемая через `new Function`.
- При синтаксической ошибке бросает `CompilerError`.

Особенности classic-runtime: JSX требует наличия `React` в области видимости. `executeComponent` инжектит `React` параметром, поэтому `import React` в коде не обязателен.

### 9.2 `extractBareImports`

```ts
function extractBareImports(code: string): string[]
```

Возвращает уникальные имена пакетов (bare-импортов), игнорируя относительные (`./`, `../`) и абсолютные (`/`) пути.

Поддерживаемые формы:

```ts
import React from 'react';                         // ['react']
import { motion } from 'framer-motion';            // ['framer-motion']
import * as THREE from 'three';                    // ['three']
import React, { useState } from "react";           // ['react']
import 'swiper/css';                               // ['swiper/css']
import type { FC } from 'react';                   // ['react']
import { x } from '@scope/thing';                  // ['@scope/thing']
import get from 'lodash/fp/get';                   // ['lodash/fp/get']
```

Ограничения:

- не является полноценным AST-парсером: `import` внутри строк/комментариев может дать ложное срабатывание;
- динамический `import('pkg')` не извлекается;
- сложные формы (`import a, * as b from ...`) не гарантируются.

---

## 10. Library Manager

### 10.1 `ModuleCache`

```ts
class ModuleCache {
  register(name: string, module: any): void;
  get(name: string): any | undefined;
  getAll(): ModuleRegistry; // поверхностная копия
  has(name: string): boolean; // false для falsy-значений
}
```

- `getAll()` возвращает копию: мутация снимка не меняет кэш.
- Повторный `register(name, ...)` перезаписывает значение.

### 10.2 `loadMissingModules`

```ts
type ModuleImporter = (url: string) => Promise<any>;

function loadMissingModules(
  packages: string[],
  cache: ModuleCache,
  importer?: ModuleImporter,
): Promise<void>
```

- Для каждого пакета: если `cache.has(pkg)` — пропустить; иначе `importer('https://esm.sh/' + pkg)`.
- Загрузка всех пакетов параллельна (`Promise.all`).
- Нормализация результата: `{ ...module, default: module.default || module, __esModule: true }`.
  - `default` гарантированно есть (для CJS-библиотек это сам модуль).
  - `__esModule: true` нужен, чтобы интероп Sucrase (`_interopRequireDefault`) не заворачивал модуль повторно.
- При ошибке бросает `NetworkModuleError(pkg, originalMessage)`.

Стандартный импортёр — `import(/* @vite-ignore */ url)`; в тестах/других средах можно передать свой.

### 10.3 Загрузка с CDN в разных средах

| Среда | Загрузчик | Механика |
|---|---|---|
| Браузер | дефолтный | нативный `import('https://esm.sh/<pkg>')`; зависимости ESM резолвятся относительно esm.sh |
| Node | пользовательский | `https`-импорт не поддерживается; адаптер качает `https://esm.sh/<pkg>?bundle` (самодостаточный ESM) и импортирует из временного файла |
| Remotion-бандл | `(url) => new Function('u','return import(u)')(url)` | `new Function` экранирует webpack, чтобы выполнился нативный `import()` |

Особенности:

- Пакеты с внешним React (`framer-motion`) при загрузке ссылаются на `react`/`jsx-runtime` как на внешние зависимости. В браузере для рендера нужен общий React-инстанс (import map / `?external=react`), в Node-тесте достаточно факта загрузки.
- `?bundle` у esm.sh делает бандл самодостаточным (кроме явных external). Адаптер проверяет отсутствие остаточных абсолютных импортов.

---

## 11. Sandbox (изоляция и выполнение)

### 11.1 `getShadowedGlobals`

```ts
function getShadowedGlobals(): {
  forbiddenKeys: string[];
  shadowValues: undefined[];
}
```

`forbiddenKeys`:

```
window, document, localStorage, sessionStorage, fetch,
XMLHttpRequest, indexedDB, navigator
```

`shadowValues` — массив `undefined` той же длины. Функция каждый раз создаёт новые массивы (нет общего мутабельного состояния).

### 11.2 `executeComponent`

```ts
function executeComponent(
  compiledCode: string,
  registry: ModuleRegistry,
  globals: SandboxGlobals,
): any
```

Как работает:

1. `customRequire(name)` возвращает `registry[name]` или бросает `SecurityError`.
2. Требуется `registry.react`, иначе бросается `Error("Модуль 'react' обязателен для компиляции TSX.")`.
3. Формируется функция:

```js
new Function(
  'require', 'exports', 'React',
  ...Object.keys(globals),      // кастомные глобалы (staticFile и др.)
  ...forbiddenKeys,             // затеняются в undefined
  compiledCode,
);
```

4. Возврат: `exports.default` → первый именованный экспорт → `null`.
5. Ошибки времени выполнения оборачиваются в `Error('[Runtime Error]: ...')`, **кроме** `SecurityError`, который пробрасывается как есть.

Контракт глобалов: ключи `globals` должны быть валидными идентификаторами JS (они становятся именами параметров).

---

## 12. Assets (ZIP)

```ts
type AssetArchive = Record<string, Uint8Array>;

function extractAssetZip(zip: Uint8Array): AssetArchive;

function createAssetUrlMap(
  archive: AssetArchive,
  createUrl: (bytes: Uint8Array, filename: string) => string,
): Record<string, string>;

function releaseAssetUrls(urls: Record<string, string>, revoke: (url: string) => void): void;
```

### `extractAssetZip`

- Распаковывает ZIP (через `fflate.unzipSync`).
- Игнорирует записи каталогов (пути, оканчивающиеся на `/`).
- Игнорирует системную папку macOS `__MACOSX/`.
- Нормализует ведущий `./`.
- Ключи — пути внутри архива (`assets/clip.mp4`).

### `createAssetUrlMap`

- Превращает архив в карту `имя файла → url` (берётся basename, подкаталоги схлопываются).
- Фабрика URL внедряется, поэтому функция тестируема без DOM.

### `releaseAssetUrls`

- Вызывает `revoke` для каждого URL (обычно `URL.revokeObjectURL`), чтобы не текла память.

Типовое использование в браузере:

```ts
const archive = extractAssetZip(zipBytes);
const urls = createAssetUrlMap(archive, (bytes) => URL.createObjectURL(new Blob([bytes])));
facade.setAssets(urls);
// ... later
releaseAssetUrls(urls, URL.revokeObjectURL);
```

---

## 13. Интеграция с JSON-каталогом виджетов

Примеры: `examples/vidora-widgets.json` (Word By Word), `examples/vidora-widgets-logo.json` (Logo Shine Badge).

### 13.1 Схема каталога

```ts
interface VidoraCatalog {
  vidora_schema_version: string; // '1.0'
  exported_at: string;           // ISO 8601
  generator: string;             // 'Vidora Motion Studio'
  widgets: VidoraWidget[];
}

interface VidoraWidget {
  id: string;               // уникальный id и id Remotion-композиции
  name: string;
  category: string;
  description: string;
  import_path: string;      // '../widgets'
  is_custom: boolean;
  props: VidoraProp[];
  default_props: Record<string, unknown>;
  example_snippet: string;
  tags: string[];
  tsx_code: string;         // исходник React-компонента
}

interface VidoraProp {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'object';
  required: boolean;
  default: unknown;
  enum_values?: string[];
  description: string;
}
```

### 13.2 Контракт рендера виджета

- `tsx_code` компилируется `compileTsx` и выполняется `executeComponent`. Виджеты экспортируют **именованный** экспорт (`export const WordByWordText16x9`), поэтому evaluator возвращает первый именованный экспорт.
- `default_props` прокидываются в компонент как React-пропсы. Любой проп из `props[]` можно переопределить.
- Рекомендуемая обёртка: `AbsoluteFill` для центрирования + `<style>` с Tailwind CSS, скомпилированным из `tsx_code`.

### 13.3 Приоритет источников контента (Logo Shine Badge)

```
imageUrl  >  iconName  >  logoText
```

- `imageUrl` непустой → рендерится `<img src={imageUrl}>`, текст/иконка игнорируются.
- иначе `iconName` непустой → `LucideIcons[iconName]`.
- иначе → текст `logoText`.

### 13.4 Разбор изображений

`imageUrl` должен быть валидным источником для `<img>`:

| Источник | Как получается | Где работает |
|---|---|---|
| `blob:` | `createAssetUrlMap` из ZIP | Браузер (клиентский рендер) |
| `data:` | inline base64 | Везде |
| `https://` | внешний URL | Везде (нужна сеть) |
| `asset:<path>` | токен харнесса → `staticFile(path)` | Серверный рендер Remotion |

Токен `asset:` — соглашение рендер-харнесса (§14): значение `asset:assets/logo.svg` резолвится в `staticFile('assets/logo.svg')`. Для гарантии, что произвольный `<img>` успеет загрузиться до снимка кадра, харнесс дополнительно монтирует скрытый Remotion `<Img>` с тем же `src`.

### 13.5 Проверка, что пропсы действительно работают

`render/props.e2e.test.ts`:

- структурно (без браузера) вызывает компонент с разными пропсами и обходит дерево React-элементов: проверяет `logoText`, `style.width` (`size`), `style.color`, `<img src>`, подстановку иконки и дефолты;
- рендерит PNG для вариантов `PropsDefault`, `PropsRedSmall`, `PropsGreenBig`, `PropsImage`, `PropsIcon` и проверяет, что файлы различаются.

---

## 14. Рендер-харнесс (эталонная интеграция)

Каталог `render/` — не часть библиотеки, а эталонный потребитель песочницы.

| Скрипт | Вход | Выход |
|---|---|---|
| `npm run render` | встроенная сцена | `render/out/frame-30.png`, `sandbox.mp4` |
| `npm run render:assets` | ZIP (`render/public/assets`) | `asset-still.png`, `asset-video.mp4` |
| `npm run render:example` | `examples/remotion-scene.tsx` | `example-frame-*.png`, `example-map.mp4` |
| `npm run render:widgets` | `examples/vidora-widgets.json` | `widget-*.png`, `widget-*.mp4` |
| `npm run render:widgets:logo` | `examples/vidora-widgets-logo.json` | `widget-LogoShineBadge*.png` |
| `npm run render:props` | лого-каталог + вариации | `props-Props*.png` |

Механика:

1. Node-скрипт читает каталог/сцену, компилирует Tailwind из исходников и пишет сгенерированные модули в `render/.generated/`.
2. `render/entry-*.tsx` — точка входа Remotion: импортирует описание, компилирует/выполняет TSX песочницей, регистрирует `Composition` через `registerRoot`.
3. `@remotion/bundler` собирает бандл, `@remotion/renderer` рендерит `renderStill`/`renderMedia` в headless Chrome.

Переменная окружения `REMOTION_BROWSER` — путь к Chrome/Edge, если автопоиск не сработал (по умолчанию ищется `C:\Program Files\Google\Chrome\Application\chrome.exe`).

`renderWidgets` принимает путь к каталогу вторым аргументом:

```bash
node render/render-widgets.mjs examples/vidora-widgets-logo.json
```

---

## 15. Модель безопасности

### Что даёт песочница

- Белый список модулей: `require` резолвит только то, что зарегистрировано в `ModuleRegistry`; всё прочее → `SecurityError`.
- Затенение опасных глобалов (`window`, `document`, `fetch`, `localStorage`, ...) — внутри функции они `undefined`.
- Ограниченная поверхность: код не получает доступ к замыканию модуля хоста, только к параметрам `new Function`.

### Чего песочница НЕ гарантирует

- `new Function` исполняет код в основной области JavaScript. Это **defense-in-depth**, а не жёсткий sandbox. Целенаправленная атака (например, через `Function`-конструктор/прототипы) теоретически возможна.
- Требуется CSP-разрешение `unsafe-eval` для `new Function`; при этом CSP не сможет запретить `eval` в самом сгенерированном коде.
- Для недоверенного кода рекомендуется дополнительная изоляция: `iframe` с другим origin, `Worker` или серверная валидация.

### Рекомендации

- Всегда предрегистрируйте `react` (и все доверенные библиотеки) в `initialRegistry`.
- Не храните секреты в `SandboxGlobals`, которые становятся параметрами `new Function`.
- Ограничивайте внешние URL CDN, если нужен контроль (через собственный `importer`).

---

## 16. Тестирование

| Команда | Что проверяет |
|---|---|
| `npm test` | Юнит-тесты (77 тестов): analyzer, transform, cache, loader, scope, evaluator, errors, zip, facade, `useLiveSandbox` |
| `npm run test:e2e` | E2E: реальный рендер через Remotion + Chrome (без ассетов, с ZIP, пример, виджеты, пропсы) |
| `npm run test:network` | Сетевые тесты: реальная загрузка библиотек с esm.sh (d3, three, canvas-confetti, framer-motion) |
| `npm run verify:video` | Проверка выданного MP4: контейнер (`ftyp`/`moov`), кодек `avc1`, размеры, длительность, сверка с `ffprobe` |
| `npm run typecheck` | `tsc --noEmit` |

Юнит-тесты не требуют сети и браузера: `loader` тестируется через инъекцию `importer`, `zip` — через `fflate` и фейковую фабрику URL, React-хук — в jsdom.

---

## 17. Совместимость и версии

- **Node.js:** 18+ (e2e проверен на Node 24).
- **React:** 17/18/19 (peer `>=17`; эталонные тесты — 18).
- **Браузеры:** любые с поддержкой `new Function`, `URL.createObjectURL`, динамического `import()`.
- **Схема каталога:** `vidora_schema_version: "1.0"`.
- **Remotion (харнесс):** 4.x.

### Изменения поведения относительно чернового плана

| Место | Было | Стало | Причина |
|---|---|---|---|
| `analyzer` | regex захватывал 1 символ | `([^'"]+)` + фильтр путей | баг: пакеты не находились |
| `loader` | без `__esModule` | `__esModule: true` | интероп Sucrase заворачивал модуль |
| `evaluator` | `SecurityError` заворачивался | пробрасывается как есть | сохранить тип ошибки |
| `evaluator` | fallback на `default` (мёртвый код) | первый именованный экспорт | поддержать `export const Scene` |
| `useLiveSandbox` | `localAssets` по ссылке в deps | сравнение по значению | бесконечный цикл рекомпиляции |

---

## 18. Сборка и публикация

### 18.1 Артефакты

`npm run build` (`tsup`) создаёт `dist/`:

| Файл | Формат |
|---|---|
| `dist/index.js` | ESM |
| `dist/index.cjs` | CommonJS |
| `dist/index.d.ts` / `dist/index.d.cts` | Типы |
| `*.map` | Source maps |

`package.json`:

```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" }
  },
  "files": ["dist", "README.md", "API.md"],
  "sideEffects": false
}
```

Внешние зависимости (не бандлятся): `react` (`peerDependencies`), `sucrase`, `fflate` (`dependencies`).

### 18.2 Скрипты

| Скрипт | Действие |
|---|---|
| `build` | `tsup` — сборка `dist/` |
| `prepack` | автосборка перед `npm pack`/`npm publish` |
| `prepublishOnly` | `npm run typecheck && npm test` |
| `pack:check` | `npm pack --dry-run` |
| `verify:video` | `node render/verify-video.mjs <file.mp4 \| dir>` |

### 18.3 Инструмент `verify-video`

`render/mp4-metadata.mjs` разбирает ISO-BMFF без внешних зависимостей и возвращает:

```ts
interface Mp4Metadata {
  majorBrand: string | null;
  brands: string[];
  hasMoov: boolean;
  hasAvc1: boolean;
  timescale: number | null;
  duration: number | null;
  durationSeconds: number | null;
  width: number | null;   // px (16.16 fixed-point)
  height: number | null;
}
```

`render/verify-video.mjs <path>` печатает JSON-отчёт по каждому `.mp4` и завершается кодом `1`, если файл невалиден. Если `ffprobe` доступен, добавляется поле `ffprobe` с `codec`, `width`, `height`, `nbFrames`, `fps`, `durationSeconds`.

### 18.4 Игнорируемые артефакты

`.gitignore`: `node_modules/`, `dist/`, `coverage/`, `render/out/`, `render/bundle*/`, `render/.generated/`, `render/public/`, `*.log`, `*.tgz`.
