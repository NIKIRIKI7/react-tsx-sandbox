import { ByteWriter } from './byte-writer';

export interface Mp4VideoSample {
  data: Uint8Array;
  isKeyframe: boolean;
  durationTimescale: number;
}

export interface Mp4MuxerOptions {
  width: number;
  height: number;
  fps: number;
  timescale?: number;
  description?: Uint8Array;
}

export class IsobmffMuxer {
  private width: number;
  private height: number;
  private timescale: number;
  private avcCDescription: Uint8Array | null = null;
  private samples: Mp4VideoSample[] = [];

  constructor(options: Mp4MuxerOptions) {
    this.width = options.width;
    this.height = options.height;
    this.timescale = options.timescale ?? 90_000;
    if (options.description) {
      this.setDecoderDescription(options.description);
    }
  }

  public setDecoderDescription(description: Uint8Array): void {
    this.avcCDescription = description;
  }

  public addSample(data: Uint8Array, isKeyframe: boolean, durationSeconds: number): void {
    this.samples.push({
      data,
      isKeyframe,
      durationTimescale: Math.max(1, Math.round(durationSeconds * this.timescale)),
    });
  }

  public finalize(): Blob {
    const writer = new ByteWriter(
      this.samples.reduce((acc, s) => acc + s.data.byteLength, 0) + 16384,
    );

    // ftyp
    const ftypStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('ftyp');
    writer.writeAscii('isom');
    writer.writeUint32BE(0x00000200);
    writer.writeAscii('isom');
    writer.writeAscii('mp41');
    writer.writeAscii('mp42');
    writer.writeAscii('avc1');
    writer.patchUint32BE(ftypStart, writer.position - ftypStart);

    // mdat
    const mdatStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('mdat');

    const sampleOffsets: number[] = [];
    const sampleSizes: number[] = [];

    for (const sample of this.samples) {
      sampleOffsets.push(writer.position);
      sampleSizes.push(sample.data.byteLength);
      writer.writeBytes(sample.data);
    }

    writer.patchUint32BE(mdatStart, writer.position - mdatStart);

    // moov
    const moovStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('moov');

    const totalDuration = this.samples.reduce((acc, s) => acc + s.durationTimescale, 0);
    this.writeMvhd(writer, totalDuration);
    this.writeTrak(writer, totalDuration, sampleOffsets, sampleSizes);

    writer.patchUint32BE(moovStart, writer.position - moovStart);

    return writer.toBlob('video/mp4');
  }

  private writeMvhd(writer: ByteWriter, duration: number): void {
    const start = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('mvhd');
    writer.writeUint8(0);
    writer.writeUint24BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(this.timescale);
    writer.writeUint32BE(duration);
    writer.writeUint32BE(0x00010000);
    writer.writeUint16BE(0x0100);
    writer.writeBytes(new Uint8Array(10));
    writer.writeUint32BE(0x00010000);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0x00010000);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0x40000000);
    writer.writeBytes(new Uint8Array(24));
    writer.writeUint32BE(2);
    writer.patchUint32BE(start, writer.position - start);
  }

  private writeTrak(
    writer: ByteWriter,
    duration: number,
    sampleOffsets: number[],
    sampleSizes: number[],
  ): void {
    const start = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('trak');

    const tkhdStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('tkhd');
    writer.writeUint8(0);
    writer.writeUint24BE(0x000007);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(1);
    writer.writeUint32BE(0);
    writer.writeUint32BE(duration);
    writer.writeBytes(new Uint8Array(8));
    writer.writeUint16BE(0);
    writer.writeUint16BE(0);
    writer.writeUint16BE(0);
    writer.writeUint16BE(0);
    writer.writeUint32BE(0x00010000);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0x00010000);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0x40000000);
    writer.writeUint32BE(this.width << 16);
    writer.writeUint32BE(this.height << 16);
    writer.patchUint32BE(tkhdStart, writer.position - tkhdStart);

    this.writeMdia(writer, duration, sampleOffsets, sampleSizes);
    writer.patchUint32BE(start, writer.position - start);
  }

  private writeMdia(
    writer: ByteWriter,
    duration: number,
    sampleOffsets: number[],
    sampleSizes: number[],
  ): void {
    const start = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('mdia');

    const mdhdStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('mdhd');
    writer.writeUint8(0);
    writer.writeUint24BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(this.timescale);
    writer.writeUint32BE(duration);
    writer.writeUint16BE(0x55c4);
    writer.writeUint16BE(0);
    writer.patchUint32BE(mdhdStart, writer.position - mdhdStart);

    const hdlrStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('hdlr');
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeAscii('vide');
    writer.writeBytes(new Uint8Array(12));
    writer.writeAscii('VideoHandler\0');
    writer.patchUint32BE(hdlrStart, writer.position - hdlrStart);

    this.writeMinf(writer, sampleOffsets, sampleSizes);
    writer.patchUint32BE(start, writer.position - start);
  }

  private writeMinf(
    writer: ByteWriter,
    sampleOffsets: number[],
    sampleSizes: number[],
  ): void {
    const start = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('minf');

    const vmhdStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('vmhd');
    writer.writeUint8(0);
    writer.writeUint24BE(1);
    writer.writeUint16BE(0);
    writer.writeUint16BE(0);
    writer.writeUint16BE(0);
    writer.writeUint16BE(0);
    writer.patchUint32BE(vmhdStart, writer.position - vmhdStart);

    const dinfStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('dinf');
    const drefStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('dref');
    writer.writeUint32BE(0);
    writer.writeUint32BE(1);
    writer.writeUint32BE(12);
    writer.writeAscii('url ');
    writer.writeUint32BE(0x00000001);
    writer.patchUint32BE(drefStart, writer.position - drefStart);
    writer.patchUint32BE(dinfStart, writer.position - dinfStart);

    this.writeStbl(writer, sampleOffsets, sampleSizes);
    writer.patchUint32BE(start, writer.position - start);
  }

  private writeStbl(
    writer: ByteWriter,
    sampleOffsets: number[],
    sampleSizes: number[],
  ): void {
    const start = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('stbl');

    this.writeStsd(writer);

    // stts
    const sttsStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('stts');
    writer.writeUint32BE(0);

    const sttsEntries: Array<{ count: number; delta: number }> = [];
    for (const sample of this.samples) {
      const delta = sample.durationTimescale;
      const last = sttsEntries[sttsEntries.length - 1];
      if (last && last.delta === delta) {
        last.count++;
      } else {
        sttsEntries.push({ count: 1, delta });
      }
    }
    writer.writeUint32BE(sttsEntries.length);
    for (const entry of sttsEntries) {
      writer.writeUint32BE(entry.count);
      writer.writeUint32BE(entry.delta);
    }
    writer.patchUint32BE(sttsStart, writer.position - sttsStart);

    // stss
    const keyframes: number[] = [];
    this.samples.forEach((sample, index) => {
      if (sample.isKeyframe) keyframes.push(index + 1);
    });
    if (keyframes.length < this.samples.length) {
      const stssStart = writer.position;
      writer.writeUint32BE(0);
      writer.writeAscii('stss');
      writer.writeUint32BE(0);
      writer.writeUint32BE(keyframes.length);
      for (const kf of keyframes) {
        writer.writeUint32BE(kf);
      }
      writer.patchUint32BE(stssStart, writer.position - stssStart);
    }

    // stsc
    const stscStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('stsc');
    writer.writeUint32BE(0);
    writer.writeUint32BE(1);
    writer.writeUint32BE(1);
    writer.writeUint32BE(1);
    writer.writeUint32BE(1);
    writer.patchUint32BE(stscStart, writer.position - stscStart);

    // stsz
    const stszStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('stsz');
    writer.writeUint32BE(0);
    writer.writeUint32BE(0);
    writer.writeUint32BE(sampleSizes.length);
    for (const size of sampleSizes) {
      writer.writeUint32BE(size);
    }
    writer.patchUint32BE(stszStart, writer.position - stszStart);

    // stco
    const stcoStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('stco');
    writer.writeUint32BE(0);
    writer.writeUint32BE(sampleOffsets.length);
    for (const offset of sampleOffsets) {
      writer.writeUint32BE(offset);
    }
    writer.patchUint32BE(stcoStart, writer.position - stcoStart);

    writer.patchUint32BE(start, writer.position - start);
  }

  private writeStsd(writer: ByteWriter): void {
    const stsdStart = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('stsd');
    writer.writeUint32BE(0);
    writer.writeUint32BE(1);

    const avc1Start = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('avc1');
    writer.writeBytes(new Uint8Array(6));
    writer.writeUint16BE(1);
    writer.writeUint16BE(0);
    writer.writeUint16BE(0);
    writer.writeBytes(new Uint8Array(12));
    writer.writeUint16BE(this.width);
    writer.writeUint16BE(this.height);
    writer.writeUint32BE(0x00480000);
    writer.writeUint32BE(0x00480000);
    writer.writeUint32BE(0);
    writer.writeUint16BE(1);
    const compName = new Uint8Array(32);
    compName[0] = 4;
    compName[1] = 0x61;
    compName[2] = 0x76;
    compName[3] = 0x63;
    compName[4] = 0x31;
    writer.writeBytes(compName);
    writer.writeUint16BE(0x0018);
    writer.writeInt16BE(-1);

    this.writeAvcC(writer);
    writer.patchUint32BE(avc1Start, writer.position - avc1Start);
    writer.patchUint32BE(stsdStart, writer.position - stsdStart);
  }

  private writeAvcC(writer: ByteWriter): void {
    const start = writer.position;
    writer.writeUint32BE(0);
    writer.writeAscii('avcC');

    if (this.avcCDescription && this.avcCDescription.byteLength > 0) {
      writer.writeBytes(this.avcCDescription);
    } else {
      writer.writeUint8(1);
      writer.writeUint8(0x42);
      writer.writeUint8(0x00);
      writer.writeUint8(0x1f);
      writer.writeUint8(0xff);
      writer.writeUint8(0xe0);
      writer.writeUint8(0x00);
      writer.writeUint8(0x00);
    }

    writer.patchUint32BE(start, writer.position - start);
  }
}
