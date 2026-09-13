import { describe, it, expect, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { extractAssetZip, createAssetUrlMap, releaseAssetUrls } from './zip';

function sampleZip(withMacOsx = false) {
  const entries: Record<string, Uint8Array> = {
    'clip.mp4': strToU8('fake-video-bytes'),
    'logo.svg': strToU8('<svg/>'),
    'nested/meta.json': strToU8('{"ok":true}'),
  };
  if (withMacOsx) entries['__MACOSX/._clip.mp4'] = strToU8('junk');
  return zipSync(entries);
}

describe('assets/zip.extractAssetZip', () => {
  it('распаковывает все файлы архива', () => {
    const archive = extractAssetZip(sampleZip());

    expect(Object.keys(archive).sort()).toEqual(['clip.mp4', 'logo.svg', 'nested/meta.json']);
    expect(new TextDecoder().decode(archive['clip.mp4'])).toBe('fake-video-bytes');
  });

  it('игнорирует записи каталогов', () => {
    const archive = extractAssetZip(sampleZip());
    expect(Object.keys(archive).some((path) => path.endsWith('/'))).toBe(false);
  });

  it('игнорирует системную папку macOS __MACOSX', () => {
    const archive = extractAssetZip(sampleZip(true));
    expect(Object.keys(archive).some((path) => path.startsWith('__MACOSX/'))).toBe(false);
  });

  it('возвращает пустой объект для пустого архива', () => {
    expect(extractAssetZip(zipSync({}))).toEqual({});
  });
});

describe('assets/zip.createAssetUrlMap', () => {
  it('строит карту filename -> url через внедрённую фабрику', () => {
    const archive = extractAssetZip(sampleZip());
    const factory = vi.fn((bytes: Uint8Array, filename: string) => `blob:${filename}:${bytes.length}`);

    const urls = createAssetUrlMap(archive, factory);

    expect(urls['clip.mp4']).toBe('blob:clip.mp4:16');
    expect(urls['logo.svg']).toBe('blob:logo.svg:6');
    expect(urls['meta.json']).toBe('blob:meta.json:11');
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it('разворачивает вложенные пути по имени файла', () => {
    const archive = { 'a/b/c/logo.svg': strToU8('x') };

    expect(createAssetUrlMap(archive, () => 'blob:x')).toEqual({ 'logo.svg': 'blob:x' });
  });
});

describe('assets/zip.releaseAssetUrls', () => {
  it('отзывает каждую ссылку', () => {
    const revoke = vi.fn();

    releaseAssetUrls({ a: 'blob:a', b: 'blob:b' }, revoke);

    expect(revoke).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenCalledWith('blob:a');
    expect(revoke).toHaveBeenCalledWith('blob:b');
  });
});
