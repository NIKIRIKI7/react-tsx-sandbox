# Движок браузерного экспорта (Mediabunny Export Engine)

## Обзор архитектуры

Модуль `src/export/browser-export.ts` реализует работающий полностью на клиенте пайплайн записи видео в MP4/WebM. Кодирование и мультиплексирование выполняет библиотека **`mediabunny`** (WebCodecs/WebGPU), которая из коробки даёт корректные MP4 (ISO-BMFF, FastStart) и WebM (EBML/Matroska) без собственных муксеров.

### Почему `mediabunny`
- **Надёжные контейнеры**: валидированные `ffprobe` форматы MP4 и WebM, автоматическая сборка `moov`/MDAT, `stts`/`stsz`/`stco`, чанков `Cluster` WebM, кодек-профилей H.264.
- **Простота**: `Output` + `Mp4OutputFormat/WebMOutputFormat` + `BufferTarget` + `CanvasSource` заменяют вручную написанные муксеры (ISO-BMFF/EBML) и бинарный писатель.
- **Поддержка**: браузеры с WebCodecs (`VideoEncoder`) — Chrome/Edge 94+, Safari 16.4+, Firefox 130+.

### Структура модулей

```text
src/export/
├── browser-export.ts          <-- фасад экспорта (Mediabunny-пайплайн)
├── browser-export.test.ts     <-- unit-тесты (битрейт, чётные размеры, моки mediabunny)
└── (muxers/ удалены — мультиплексирование отдано mediabunny)
```

---

## Пайплайн

```
Container (Remotion Player)
      │ seekTo(frame) → waitRender (rAF ×2) → waitForMediaElements (ждёт seeked/canplay у <video>)
      ▼
takeContainerSnapshot() → JPEG data-URL (качество 1.0, фон чёрный #000000)
      │ drawDataUrlToCanvas() → createImageBitmap (фолбэк new Image()), alpha:false
      ▼
HTMLCanvasElement → CanvasSource(canvas, { codec, bitrate })
      │ videoSource.add(timestampSec, durationSec) → WebCodecs VideoEncoder
      ▼
mediabunny Output (Mp4OutputFormat | WebMOutputFormat) → BufferTarget
      ▼
Blob (video/mp4 | video/webm) → downloadExportBlob() / ObjectURL / fetch
```

Ключевые оптимизации скорости:
- **Снимок в JPEG**: `format: 'image/jpeg', quality: 1.0` — самый быстрый браузерный формат кадра.
- **`createImageBitmap`**: декодирование кадра вынесено с главного потока (фолбэк — `new Image()`).
- **`alpha: false` + чёрная подложка**: ускоряет H.264 и убирает артефакты прозрачности.
- **`waitForMediaElements`**: после `seek` ждём `seeked`/`canplay` у всех `<video>` (таймаут 300 мс) — устраняет «рывки» B-roll (`OffthreadVideo`).
- **`frameDelayMs` по умолчанию `0`**: отдельная задержка не нужна, т.к. готовность медиа жёстко ожидается.

---

## Форматы и кодеки

| `codec` | Контейнер | MIME-тип | Кодировщик |
| :--- | :--- | :--- | :--- |
| **`avc`** (H.264) | **MP4** | `video/mp4` | `mediabunny` `Mp4OutputFormat` + WebCodecs `avc` |
| **`vp9`** | **WebM** | `video/webm` | `mediabunny` `WebMOutputFormat` + WebCodecs `vp9` |
| **`vp8`** | **WebM** | `video/webm` | `mediabunny` `WebMOutputFormat` + WebCodecs `vp8` |

Пресеты качества задаются битрейтом на пиксель в секунду (`QUALITY_BPP`):

| Качество | Битрейт (бит/пикс/сек) |
| :--- | :--- |
| `low` | 0.05 |
| `medium` | 0.15 |
| `high` (дефолт) | 0.30 |

`calculateBitrate(width, height, fps, quality)` = `round(width * height * fps * BPP)`.
Явный `bitrate` в опциях перекрывает расчёт.

Размеры кадра нормализуются до чётных (`toEvenFrameSize`) — требование H.264/WebCodecs.

---

## Ключевые реализации

- `assertWebCodecs()` / `supportsBrowserExport()` — проверка наличия `VideoEncoder` в браузере.
- `waitForMediaElements(container)` — дожидается готовности кадра во всех `<video>` (для B-roll).
- `defaultWaitRender(frameDelayMs)` — ожидание обновления DOM: двойной `requestAnimationFrame` + опциональная задержка.
- `drawDataUrlToCanvas(dataUrl, canvas, w, h)` — перенос снимка на экспортный canvas через `createImageBitmap`; чёрная заливка перед отрисовкой.
- `exportBrowserVideo()` — создаёт `Output`, `CanvasSource` и `BufferTarget`, добавляет видео-трек, ждёт кадры (поддержка `AbortSignal`), вызывает `finalize()` и возвращает `Blob`.
- `downloadExportBlob(blob, filename?)` — скачивание с именем `sandbox-export-<ts>.{mp4|webm}`.

Прогресс: `onProgress({ frame, totalFrames, progress, phase })`, фазы `capturing → encoding → done`.

---

## Быстрый старт

### Программный экспорт (Headless)
```ts
import { exportBrowserVideo, downloadExportBlob } from 'browser-tsx-sandbox/export';

const videoBlob = await exportBrowserVideo({
  container: document.getElementById('player-root')!,
  durationInFrames: 150,
  fps: 30,
  width: 1920,
  height: 1080,
  codec: 'avc',
  quality: 'high',
  seekTo: (frame) => playerRef.current?.seekTo(frame),
  onProgress: ({ progress, phase }) => {
    console.log(`${Math.round(progress * 100)}% [${phase}]`);
  },
});

downloadExportBlob(videoBlob, 'my-render.mp4');
```

### Использование UI Primitives
```tsx
<PlayerSandbox.Root config={{ code, durationInFrames: 300, fps: 30 }}>
  <PlayerSandbox.ExportButton filename="video.mp4" codec="avc" quality="high">
    {({ isExporting, progress, exportVideo }) => (
      <button onClick={exportVideo} disabled={isExporting}>
        {isExporting ? `Экспорт ${Math.round((progress ?? 0) * 100)}%` : 'Скачать MP4'}
      </button>
    )}
  </PlayerSandbox.ExportButton>
</PlayerSandbox.Root>
```

---

## Ограничения
- Пайплайн пишет только видео-трек: аудио в браузерный экспорт не включается.
- Экспорт работает только в браузерах с `VideoEncoder`; `supportsBrowserExport()` позволяет проверить поддержку заранее.
- Зависимость от внешнего пакета `mediabunny` (в отличие от прежних встроенных муксеров).

## Проверка
- `npm run typecheck` — чисто.
- `npm test` — 259 passed (включая 8 тестов `src/export/browser-export.test.ts`).
- `npm run build` / `npm run demo:build` — сборка включает `mediabunny` из `node_modules`.