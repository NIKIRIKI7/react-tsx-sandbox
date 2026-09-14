# Плагины и Tailwind CSS

Библиотека `browser-tsx-sandbox` оснащена лёгкой системой плагинов (Pipeline Plugins). Плагины перехватывают код на этапах **до** компиляции (работа с исходным TSX/TypeScript) и **после** компиляции (работа с готовым CommonJS JavaScript).

Это открывает возможности для авто-импортов, минификации, внедрения CSS, добавления ватермарок и многого другого — без изменения кода пользовательских сцен.

---

## Подключение Tailwind CSS (JIT)

Обычно Tailwind в браузерных песочницах — боль: полный CSS со всеми классами весит мегабайты. В SDK встроен **браузерный JIT-компилятор Tailwind v4**: он сканирует код пользователя, находит используемые классы (включая произвольные значения вроде `opacity-[0.035]`) и генерирует CSS только для них.

### Базовое использование

Импортируйте `createTailwindJitPlugin` из subpath `browser-tsx-sandbox/plugins` и передайте его в `config.plugins`.

> ⚠️ **Важно:** всегда инициализируйте плагин через `useMemo` — иначе новый экземпляр будет пересоздаваться на каждом рендере и триггерить повторные компиляции.

```tsx
import React, { useMemo } from 'react';
import { PlayerSandbox } from 'browser-tsx-sandbox/player';
import { createTailwindJitPlugin } from 'browser-tsx-sandbox/plugins';

export function TailwindEditor() {
  // 1. Инициализируем плагин один раз
  const plugins = useMemo(() => [createTailwindJitPlugin()], []);

  const code = `
    import React from 'react';
    import { AbsoluteFill } from 'remotion';

    export default function Scene() {
      return (
        <AbsoluteFill className="flex items-center justify-center bg-slate-950">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 animate-pulse">
            Hello Tailwind!
          </h1>
        </AbsoluteFill>
      );
    }
  `;

  return (
    <PlayerSandbox
      config={{
        code,
        plugins, // 2. Подключаем к песочнице
        width: 1920,
        height: 1080,
      }}
    />
  );
}
```

### Изоляция стилей (Scoping)

`createTailwindJitPlugin` изолирует сгенерированные стили. Для каждого файла он собирает список классов (`collectTailwindClasses` — собирает даже классы, собранные из шаблонных строк), компилирует из них CSS и оборачивает экспортируемый компонент в `TailwindJitWrapper`:

```
export default function Scene → <div class="__tsx_tw-<hash>">
                                ├ <style>{scopedCss}</style>
                                └ <Scene />
```

Уникальный класс-область (например `__tsx_tw-1a2b3c`) применяется к обёртке, поэтому **стили видео не ломают вёрстку сайта**, а стили сайта не просачиваются внутрь анимации. Собранный CSS кэшируется (LRU), так что при HMR/редактировании перекомпилируются только реально изменившиеся файлы.

### Кастомизация темы (Tailwind v4)

Опции `createTailwindJitPlugin`:

| Опция | Тип | По умолчанию |
|---|---|---|
| `name` | `string` | `'tailwind-jit'` |
| `scope` | `string` | `'__tsx_tw'` |
| `css` | `string` | — (доп. CSS для входного файла компилятора) |
| `base` | `string` | `process.cwd()` (база для `@import` в `loadStylesheet`) |
| `builder` | `(classes, scopeClass) => string \| Promise<string>` | официальный `compile()`/`build()` Tailwind |

Кастомная тема — просто блок `@theme` в опции `css`:

```tsx
const plugins = useMemo(() => [
  createTailwindJitPlugin({
    css: `
      @theme {
        --color-brand-red: #ff4b4b;
        --color-brand-dark: #131926;
        --font-display: "Montserrat", sans-serif;
      }
    `,
  }),
], []);
```

Теперь в классах доступны `bg-brand-red`, `text-brand-dark`, `font-display`.

---

## Создание собственных плагинов

Плагин — это объект, реализующий `PipelinePlugin`:

```typescript
interface PipelinePlugin {
  name: string;
  // ДО компиляции Sucrase (на вход — сырой TSX/TypeScript)
  beforeCompile?: (code: string, filepath: string) => string | Promise<string>;
  // ПОСЛЕ компиляции (на вход — готовый CommonJS)
  afterCompile?: (compiledJs: string, filepath: string) => string | Promise<string>;
}
```

- Плагины выполняются **строго в порядке массива** `plugins`.
- Хуки вызываются **для каждого кодового файла** (в VFS — для каждого файла c расширением `.{c,m}[jt]sx?`), `filepath` — путь файла (`/App.tsx`, `/components/Button.tsx`).
- `beforeCompile` умеет быть асинхронным; цепочка: `code → beforeCompile → Sucrase (TSX→JS) → afterCompile → запуск в песочнице`.
- В скомпилированном коде доступна переменная `React` и `exports` — этим пользуются плагины ниже.

### Пример 1: авто-импорт React (beforeCompile)

Пользователи часто забывают `import React from 'react'`. Плагин добавляет его в начало файла:

```tsx
const autoReactPlugin: PipelinePlugin = {
  name: 'auto-react-injector',
  beforeCompile: (code, filepath) => {
    if (!filepath.endsWith('.tsx') && !filepath.endsWith('.jsx')) return code;
    if (!code.includes('import React')) {
      return `import React from 'react';\n${code}`;
    }
    return code;
  },
};

// Использование:
const plugins = useMemo(() => [autoReactPlugin], []);
```

### Пример 2: ватермарка поверх сцены (afterCompile)

Обернём экспортируемый пользователем компонент в HOC, который рисует логотип поверх контента. В `afterCompile` код уже в CommonJS, где экспорт выглядит как `exports.default = ...`, а `React` доступен напрямую:

```tsx
const watermarkPlugin: PipelinePlugin = {
  name: 'force-watermark',
  afterCompile: (compiledJs, filepath) => {
    if (filepath !== '/App.tsx') return compiledJs;

    const wrapperCode = `
      ;(function () {
        var UserComponent = exports.default;
        if (!UserComponent || typeof UserComponent !== 'function') return;

        function WatermarkedScene(props) {
          return React.createElement(
            'div',
            { style: { width: '100%', height: '100%', position: 'relative' } },
            React.createElement(UserComponent, props),
            React.createElement(
              'div',
              { style: { position: 'absolute', bottom: 20, right: 20, color: 'white', opacity: 0.5 } },
              'Сделано в MyVideoStudio'
            )
          );
        }

        exports.default = WatermarkedScene;
      })();
    `;

    return compiledJs + '\n' + wrapperCode;
  },
};
```

> 💡 Тот же приём использует встроенный Tailwind-плагин: `afterCompile` оборачивает `exports.default` в `TailwindJitWrapper`. Если ваш плагин и Tailwind в одном массиве — порядок имеет значение: обёртки применятся в том же порядке, в котором стоят плагины.

---

## Порядок выполнения

1. Исходный код файла (например `/App.tsx`).
2. `plugin1.beforeCompile` → `plugin2.beforeCompile` → … (в порядке массива).
3. Внутренняя компиляция Sucrase (TSX → CommonJS).
4. `plugin1.afterCompile` → `plugin2.afterCompile` → … .
5. Исполнение в песочнице (runtime).

Плагины передаются в `SandboxFacadeOptions.plugins`, `UseLiveSandboxOptions.plugins` и `SandboxConfig.plugins` — то есть работают в любом интерфейсе: `<Sandbox>`, `<PlayerSandbox>` или напрямую в `useLiveSandbox`/`SandboxFacade`.