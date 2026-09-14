export class ByteWriter {
  private buffer: Uint8Array;
  private view: DataView;
  private offset = 0;

  constructor(initialCapacity = 2 * 1024 * 1024) {
    this.buffer = new Uint8Array(initialCapacity);
    this.view = new DataView(this.buffer.buffer);
  }

  public get position(): number {
    return this.offset;
  }

  public ensureCapacity(bytesNeeded: number): void {
    const required = this.offset + bytesNeeded;
    if (required <= this.buffer.byteLength) return;

    let newCap = Math.max(this.buffer.byteLength * 2, 65536);
    while (newCap < required) {
      newCap *= 2;
    }

    const next = new Uint8Array(newCap);
    next.set(this.buffer.subarray(0, this.offset));
    this.buffer = next;
    this.view = new DataView(this.buffer.buffer);
  }

  public writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  public writeUint16BE(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, value, false);
    this.offset += 2;
  }

  public writeInt16BE(value: number): void {
    this.ensureCapacity(2);
    this.view.setInt16(this.offset, value, false);
    this.offset += 2;
  }

  public writeUint24BE(value: number): void {
    this.ensureCapacity(3);
    this.view.setUint8(this.offset, (value >> 16) & 0xff);
    this.view.setUint8(this.offset + 1, (value >> 8) & 0xff);
    this.view.setUint8(this.offset + 2, value & 0xff);
    this.offset += 3;
  }

  public writeUint32BE(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, value, false);
    this.offset += 4;
  }

  public writeUint64BE(value: bigint | number): void {
    this.ensureCapacity(8);
    this.view.setBigUint64(this.offset, BigInt(value), false);
    this.offset += 8;
  }

  public writeFloat64BE(value: number): void {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, value, false);
    this.offset += 8;
  }

  public writeBytes(bytes: Uint8Array | ArrayBuffer | ArrayBufferView): void {
    let data: Uint8Array;
    if (bytes instanceof Uint8Array) {
      data = bytes;
    } else if (bytes instanceof ArrayBuffer) {
      data = new Uint8Array(bytes);
    } else {
      data = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    this.ensureCapacity(data.byteLength);
    this.buffer.set(data, this.offset);
    this.offset += data.byteLength;
  }

  public writeAscii(text: string): void {
    this.ensureCapacity(text.length);
    for (let i = 0; i < text.length; i++) {
      this.buffer[this.offset + i] = text.charCodeAt(i) & 0xff;
    }
    this.offset += text.length;
  }

  public patchUint32BE(offset: number, value: number): void {
    this.view.setUint32(offset, value, false);
  }

  public toUint8Array(): Uint8Array {
    return this.buffer.subarray(0, this.offset);
  }

  public toBlob(mimeType: string): Blob {
    const copy = this.buffer.slice(0, this.offset);
    return new Blob([copy], { type: mimeType });
  }
}
