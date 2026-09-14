# Встроенный легковесный движок экспорта (Zero-Dependency Export Engine)

## Обзор архитектуры

Модуль `src/export/browser-export.ts` реализует полностью автономный, работающий на клиенте пайплайн записи видео без сторонних зависимостей: чистый браузерный WebCodecs (`VideoEncoder` + `VideoFrame`) + компактные встроенные муксеры `src/export/muxers/`.

### Преимущества перед `mediabunny`
- **Размер бандла**: внешний монорепозиторий `mediabunny` (~1.5+ МБ) полностью удалён из зависимостей.
- **Производительность**: прямое обращение к браузерным классам `VideoEncoder` и `VideoFrame` без оверхеда абстракций.
- **Поддержка**: Chrome 94+, Edge 94+, Safari 16.4+, Firefox 130+ (нативная поддержка WebCodecs).

### Структура модулей

```text
src/export/
├── browser-export.ts          <-- фасад экспорта (API 100% совместим)
├── browser-export.test.ts
├── muxers.test.ts             <-- unit-тесты муксеров
└── muxers/
    ├── byte-writer.ts         <-- динамический бинарный буфер (BE-числа, патчинг, строки)
    ├── isobmff-muxer.ts       <-- минимальный MP4-муксер (H.264/AVC1 с avcC)
    └── ebml-muxer.ts          <-- минимальный EBML/WebM-муксер (VP8, VP9)
```

---

## Пайплайн

```
Container (Remotion Player)
      │ takeContainerSnapshot() → PNG data-URL
      ▼
Canvas → new VideoFrame(canvas, { timestamp µs, duration })
      │ VideoEncoder.configure({ codec, bitrate, framerate, avc:{format:'avc'} })
      ▼
encodedsample/chunk (H.264 AVCC | VP8/VP9)
      │ onOutput → addSample()
      ▼
IsobmffMuxer (ftyp→mdat→moov)  |  EbmlMuxer (EBML→Segment→Cluster)
      ▼
Blob (video/mp4 | video/webm) → downloadExportBlob() / ObjectURL / fetch
```

---

## Форматы и кодеки

| Кодек | Контейнер | MIME-тип | Профиль / Уровень | Совместимость |
| :--- | :--- | :--- | :--- | :--- |
| **`avc`** (H.264) | **MP4** (ISOBMFF) | `video/mp4` | Baseline 3.1 / Main 4.2 / High 5.1 (по разрешению) | QuickTime, iOS, Android, все браузеры, VLC, FFmpeg |
| **`vp9`** | **WebM** (EBML) | `video/webm` | Profile 0, 8-bit | Chrome, Firefox, VLC |
| **`vp8`** | **WebM** (EBML) | `video/webm` | VP8 Native | Устаревшие браузеры |

Разрешения кодека AVC определяются автоматически:
- `≤ 1280×720` → `avc1.42001f` (Baseline 3.1)
- `≤ 1920×1080` → `avc1.4d002a` (Main 4.2)
- выше → `avc1.640033` (High 5.1, 4K)

---

## Структура генерируемых контейнеров

### MP4 (ISO/IEC 14496-12 / 14496-15, FastStart)
```
ftyp  (isom, minor 0x00000200, compatible: isom/mp41/mp42/avc1)
mdat  (AVCC length-prefixed NAL-юниты; chunk-офсеты фиксируются для stco)
moov
 ├─ mvhd  (timescale 90000, duration = Σ sample durations)
 ├─ trak
 │   ├─ tkhd  (track enabled/in-movie/in-preview, ширины/высоты 16.16)
 │   └─ mdia
 │       ├─ mdhd  (timescale 90000, language 'und')
 │       ├─ hdlr  (handler vide)
 │       └─ minf
 │           ├─ vmhd
 │           ├─ dinf → dref → url (self-contained)
 │           └─ stbl
 │               ├─ stsd → avc1 → avcC  (description из decoderConfig)
 │               ├─ stts (Time-to-Sample, схлопнутые дельты)
 │               ├─ stss (Sync Sample; только если есть дельта-кадры)
 │               ├─ stsc (1 сэмпл на чанк)
 │               ├─ stsz (размеры сэмплов)
 │               └─ stco (смещения чанков)
```

### WebM (EBML / Matroska)
```
EBML Header  (DocType webm, версия 4, read version 2, 8-байтовые VINT)
Segment (известный размер, 8-байтовый VINT)
 ├─ Info      (TimecodeScale 1e6 = 1 мс, Duration)
 ├─ Tracks    (TrackEntry: Type 1 (video), V_VP8/V_VP9, PixelWidth/Height)
 └─ Cluster   (на каждый keyframe: Timecode + SimpleBlock'ы)
     ├─ SimpleBlock: TrackNumber VINT + int16 rel-timecode + flags + payload
     ...
```

---

## Ключевые реализации

### `ByteWriter`
Динамический `Uint8Array`-буфер: `writeUint8/16/24/32BE`, `writeInt16BE`, `writeUint64BE`, `writeFloat64BE`, `writeBytes`, `writeAscii`, `patchUint32BE` (отложенный патчинг размеров боксов), `toBlob(mimeType)`.

### `IsobmffMuxer`
Валидирован `ffprobe`: распознаётся как `mov,mp4,m4a,3gp,3g2,mj2`, корректные `codec_name=h264` и длительность.
- `avcC` берётся напрямую из `VideoEncoder` `metadata.decoderConfig.description` — гарантированная совместимость SPS/PPS с закодированным потоком (AVCC: 4-байтовые префиксы длины).
- Fallback-конфигурация Baseline 3.1 при отсутствии description.

### `EbmlMuxer`
Валидирован `ffprobe`: распознаётся как `matroska,webm`, корректные `codec_name=vp8/vp9` и длительность.
- VINT-кодирование переменной длины (1–8 байт) для ID и размеров EBML-элементов.
- Кластеры начинаются на ключевых кадрах (SimpleBlock flags 0x80=key / 0x00=delta).

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
- Архитектура с `avc: { format: 'avc' }` пишет только видео-трек: аудио в браузерный экспорт не включается.
- Полное демультиплексирование (MKV/MP4-ридеры) и аудио-кодеки (AC3/DTS/FLAC) из `mediabunny` не нужны для задачи захвата кадров плеера — они удалены.
- Экспорт работает только в браузерах с `VideoEncoder`; `supportsBrowserExport()` позволяет проверить поддержку заранее.

## Проверка
- `npm run typecheck` — чисто.
- `npm test` — 256 passed (включая 11 тестов `src/export/muxers.test.ts`).
- `npm run build` / `npm run demo:build` — в сборке нет `mediabunny`/`vendor-mediabunny`.