# Studio Demo — анализ и улучшения

## 1. Анализ демо-варианта: чего не хватает?

Демо (`/studio.html`) показывает headless-тулбар с `PlayButton`, `Timeline`, `TimeDisplay` и `VolumeControl` — но не включает `ExportButton`. Это самый сильный feature demo для потенциальных пользователей: **без Backend экспорт видео в браузере**.

Это именно тот use-case, который выделяет `browser-tsx-sandbox` от Remotion-проектов:
- Remotion требует Node + Chrome + `renderMedia` → файл MP4.
- browser-tsx-sandbox позволяет экспортировать MP4/WebM **прямо в браузере** через WebCodecs (`VideoEncoder`) + `mediabunny`.

## 2. Обновлённый StudioExample

Файл `demo/StudioExample.tsx` добавляет `ExportButton` в headless-тулбар:

```tsx
<PlayerSandbox.ExportButton filename="studio-export.mp4" codec="avc">
  {({ isExporting, progress, exportVideo, supported }) => (
    <button
      disabled={!supported || isExporting}
      onClick={exportVideo}
      className={/* ... */}
    >
      <Download size={16} />
      {isExporting ? `${Math.round(progress.progress * 100)}%` : 'Export MP4'}
    </button>
  )}
</PlayerSandbox.ExportButton>
```

### Ключевые изменения в StudioExample

| Что | Было | Стало |
|---|---|---|
| Заголовок | "Live Studio" | "Live Studio — браузерный экспорт MP4/WebM" |
| Тулбар | 4 примитива | 5 примитивов (+ `ExportButton`) |
| Иконка | — | `Download` из lucide-react |
| Disabled-состояние | — | `!supported \|\| isExporting` |
| Текст кнопки | — | "Export MP4" / `${progress}%` |

## 3. Исправленные SVG-диаграммы

Все четыре SVG-диаграммы в `assets/readme/` обновлены:
- **architecture.svg** — согласованная типографика (dominant-baseline/text-anchor: central).
- **headless.svg** — исправлена карточка примитивов.
- **hero.svg** — плавный gradient-ducking-кривизн.
- **timeline.svg** — исправлены позиции дорожек и кривая ducking.

## 4. Проверка модульной архитектуры

Скрипт `scripts/verify-architecture.mjs` проверяет:

1. **Границы модулей** — каждый модуль `src/*` не должен импортировать определённые другие модули (см. `RULES`).
2. **Циклические зависимости** — обход в глубину (DFS) по графу импортов; циклы приводят к ошибке.

Запуск:

```bash
npm run arch
```

Пример вывода при нарушении:

```
❌ [Нарушение границы] src/core/hmr.ts
   Импортирует запрещённый модуль: src/compiler
   Причина: Ядро не должно зависеть от реализаций песочницы или UI.
```

> **Примечание:** тестовые файлы (`*.test.ts`) пересекают границы модулей по设计 — это корректное поведение.
