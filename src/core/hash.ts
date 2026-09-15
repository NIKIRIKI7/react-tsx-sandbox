/**
 * Быстрый безаллокационный хэшер на базе 64-битного FNV-1a и HashCombine.
 *
 * Заменяет `JSON.stringify(vfs)` в React-хуках на O(1) сравнение дайджестов:
 * каждый файл хранит собственный контентный хэш, а корень VFS — комбинированный
 * `rootHash` (Merkle-like дерево). Изменение одного файла пересчитывает только
 * его хэш и корень, а не сериализует весь проект в мегабайтную строку.
 */

const FNV_PRIME_64 = 1099511628211n;
const FNV_OFFSET_64 = 14695981039346656037n;
const FNV_MASK_64 = 0xffffffffffffffffn;

function mix(hash: bigint, text: string): bigint {
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * FNV_PRIME_64) & FNV_MASK_64;
  }
  return hash;
}

/**
 * Вычисляет 64-битный хэш строки за один проход по кодовым точкам
 * без создания промежуточных строк (кроме финального hex-дайджеста).
 */
export function hashString(text: string): string {
  return mix(FNV_OFFSET_64, text).toString(16).padStart(16, '0');
}

/**
 * Комбинирует два числовых хэша (аналог helpers.HashCombine в esbuild).
 * Порядок аргументов значим: (h1, h2) !== (h2, h1).
 */
export function hashCombine(h1: number, h2: number): number {
  return (h1 ^ (h2 + 0x9e3779b9 + (h1 << 6) + (h1 >>> 2))) | 0;
}

export interface VfsHashes {
  /** Хэш содержимого каждого файла VFS: путь -> hex-дайджест. */
  fileHashes: Map<string, string>;
  /** Комбинированный хэш всего состояния VFS (сравнивается за O(1)). */
  rootHash: string;
}

/**
 * Вычисляет структуру хэшей VFS (Merkle-like tree hash).
 * Сравнение двух ревизий сводится к сравнению одного `rootHash`.
 */
export function computeVfsHashes(vfs: Record<string, string>): VfsHashes {
  const fileHashes = new Map<string, string>();
  const keys = Object.keys(vfs).sort();
  let combined = FNV_OFFSET_64;

  for (const key of keys) {
    const content = vfs[key] ?? '';
    const hash = hashString(content);
    fileHashes.set(key, hash);
    combined = mix(combined, key);
    combined = mix(combined, hash);
  }

  return {
    fileHashes,
    rootHash: combined.toString(16).padStart(16, '0'),
  };
}