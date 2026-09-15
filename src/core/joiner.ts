/**
 * Zero-copy чанковый компоновщик данных, созданный по образцу helpers.Joiner в esbuild.
 * Накапливает сегменты в плоском списке и формирует результирующий буфер либо
 * составной Blob без промежуточного копирования памяти.
 */
export class ChunkJoiner {
  private chunks: Uint8Array[] = [];
  private totalLength = 0;
  private lastByteVal = -1;

  public get length(): number {
    return this.totalLength;
  }

  public get lastByte(): number {
    return this.lastByteVal;
  }

  public addBytes(data: Uint8Array): void {
    if (data.byteLength === 0) return;
    this.chunks.push(data);
    this.totalLength += data.byteLength;
    this.lastByteVal = data[data.byteLength - 1];
  }

  public addString(text: string): void {
    if (!text) return;
    const bytes = new TextEncoder().encode(text);
    this.addBytes(bytes);
  }

  public addUint8(byte: number): void {
    const u8 = new Uint8Array(1);
    u8[0] = byte & 0xff;
    this.addBytes(u8);
  }

  public ensureNewlineAtEnd(): void {
    if (this.totalLength > 0 && this.lastByteVal !== 0x0a) {
      this.addUint8(0x0a);
    }
  }

  /**
   * Выделяет единый буфер строго в момент завершения за один проход.
   * Если чанк единственный, возвращает ссылку на него (без копирования).
   */
  public toUint8Array(): Uint8Array {
    if (this.chunks.length === 1) {
      return this.chunks[0];
    }
    const result = new Uint8Array(this.totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }

  /**
   * Создает Blob без объединения в ArrayBuffer — браузерный движок Blob
   * связывает исходные чанки по ссылке, экономя память при 4K/60fps экспорте.
   */
  public toBlob(mimeType: string): Blob {
    return new Blob(this.chunks as BlobPart[], { type: mimeType });
  }

  public clear(): void {
    this.chunks = [];
    this.totalLength = 0;
    this.lastByteVal = -1;
  }
}