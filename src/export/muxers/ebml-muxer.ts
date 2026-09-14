import { ByteWriter } from './byte-writer';

export interface WebmSample {
  data: Uint8Array;
  isKeyframe: boolean;
  timecodeMs: number;
}

export interface EbmlMuxerOptions {
  width: number;
  height: number;
  fps: number;
  codec: 'vp8' | 'vp9';
}

const ID_EBML = 0x1a45dfa3;
const ID_EBML_VERSION = 0x4286;
const ID_EBML_READ_VERSION = 0x42f7;
const ID_EBML_MAX_ID_LENGTH = 0x42f2;
const ID_EBML_MAX_SIZE_LENGTH = 0x42f3;
const ID_DOC_TYPE = 0x4282;
const ID_DOC_TYPE_VERSION = 0x4287;
const ID_DOC_TYPE_READ_VERSION = 0x4285;

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_MUXING_APP = 0x4d80;
const ID_WRITING_APP = 0x5741;
const ID_DURATION = 0x4489;

const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_TRACK_NUMBER = 0xd7;
const ID_TRACK_UID = 0x73c5;
const ID_TRACK_TYPE = 0x83;
const ID_CODEC_ID = 0x86;
const ID_VIDEO = 0xe0;
const ID_PIXEL_WIDTH = 0xb0;
const ID_PIXEL_HEIGHT = 0xba;

const ID_CLUSTER = 0x1f43b675;
const ID_TIMECODE = 0xe7;
const ID_SIMPLE_BLOCK = 0xa3;

export class EbmlMuxer {
  private width: number;
  private height: number;
  private fps: number;
  private codecId: string;
  private samples: WebmSample[] = [];

  constructor(options: EbmlMuxerOptions) {
    this.width = options.width;
    this.height = options.height;
    this.fps = options.fps;
    this.codecId = options.codec === 'vp9' ? 'V_VP9' : 'V_VP8';
  }

  public addSample(data: Uint8Array, isKeyframe: boolean, timecodeSeconds: number): void {
    this.samples.push({
      data,
      isKeyframe,
      timecodeMs: Math.round(timecodeSeconds * 1000),
    });
  }

  public finalize(): Blob {
    const writer = new ByteWriter(
      this.samples.reduce((acc, s) => acc + s.data.byteLength, 0) + 8192,
    );

    this.writeEbmlHeader(writer);

    this.writeElementId(writer, ID_SEGMENT);
    const segmentSizePos = writer.position;
    writer.writeUint8(0x01);
    writer.writeBytes(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]));

    const totalDurationMs =
      this.samples.length > 0
        ? this.samples[this.samples.length - 1]!.timecodeMs + Math.round(1000 / this.fps)
        : 0;
    this.writeSegmentInfo(writer, totalDurationMs);
    this.writeTracks(writer);
    this.writeClusters(writer);

    const segmentContentSize = writer.position - (segmentSizePos + 8);
    this.patch8ByteVint(writer, segmentSizePos, segmentContentSize);

    return writer.toBlob('video/webm');
  }

  private writeEbmlHeader(writer: ByteWriter): void {
    const temp = new ByteWriter(128);
    this.writeUintElement(temp, ID_EBML_VERSION, 1);
    this.writeUintElement(temp, ID_EBML_READ_VERSION, 1);
    this.writeUintElement(temp, ID_EBML_MAX_ID_LENGTH, 4);
    this.writeUintElement(temp, ID_EBML_MAX_SIZE_LENGTH, 8);
    this.writeStringElement(temp, ID_DOC_TYPE, 'webm');
    this.writeUintElement(temp, ID_DOC_TYPE_VERSION, 4);
    this.writeUintElement(temp, ID_DOC_TYPE_READ_VERSION, 2);
    this.writeMasterElement(writer, ID_EBML, temp.toUint8Array());
  }

  private writeSegmentInfo(writer: ByteWriter, durationMs: number): void {
    const temp = new ByteWriter(128);
    this.writeUintElement(temp, ID_TIMECODE_SCALE, 1_000_000);
    this.writeStringElement(temp, ID_MUXING_APP, 'browser-tsx-sandbox');
    this.writeStringElement(temp, ID_WRITING_APP, 'browser-tsx-sandbox');
    if (durationMs > 0) {
      this.writeFloatElement(temp, ID_DURATION, durationMs);
    }
    this.writeMasterElement(writer, ID_INFO, temp.toUint8Array());
  }

  private writeTracks(writer: ByteWriter): void {
    const trackEntry = new ByteWriter(256);
    this.writeUintElement(trackEntry, ID_TRACK_NUMBER, 1);
    this.writeUintElement(trackEntry, ID_TRACK_UID, 1);
    this.writeUintElement(trackEntry, ID_TRACK_TYPE, 1);
    this.writeStringElement(trackEntry, ID_CODEC_ID, this.codecId);

    const video = new ByteWriter(64);
    this.writeUintElement(video, ID_PIXEL_WIDTH, this.width);
    this.writeUintElement(video, ID_PIXEL_HEIGHT, this.height);
    this.writeMasterElement(trackEntry, ID_VIDEO, video.toUint8Array());

    const tracks = new ByteWriter(300);
    this.writeMasterElement(tracks, ID_TRACK_ENTRY, trackEntry.toUint8Array());
    this.writeMasterElement(writer, ID_TRACKS, tracks.toUint8Array());
  }

  private writeClusters(writer: ByteWriter): void {
    let currentClusterTimecode = 0;
    let clusterPayload = new ByteWriter(512 * 1024);

    const flushCluster = (): void => {
      if (clusterPayload.position === 0) return;
      const clusterWriter = new ByteWriter(clusterPayload.position + 32);
      this.writeUintElement(clusterWriter, ID_TIMECODE, currentClusterTimecode);
      clusterWriter.writeBytes(clusterPayload.toUint8Array());
      this.writeMasterElement(writer, ID_CLUSTER, clusterWriter.toUint8Array());
      clusterPayload = new ByteWriter(512 * 1024);
    };

    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i]!;

      if (sample.isKeyframe && i > 0) {
        flushCluster();
        currentClusterTimecode = sample.timecodeMs;
      }

      const relTimecode = sample.timecodeMs - currentClusterTimecode;
      const blockHeader = new ByteWriter(8);
      this.writeVint(blockHeader, 1);
      blockHeader.writeInt16BE(relTimecode);
      blockHeader.writeUint8(sample.isKeyframe ? 0x80 : 0x00);

      const blockPayload = new ByteWriter(blockHeader.position + sample.data.byteLength);
      blockPayload.writeBytes(blockHeader.toUint8Array());
      blockPayload.writeBytes(sample.data);

      this.writeMasterElement(clusterPayload, ID_SIMPLE_BLOCK, blockPayload.toUint8Array());
    }

    flushCluster();
  }

  private writeMasterElement(writer: ByteWriter, id: number, content: Uint8Array): void {
    this.writeElementId(writer, id);
    this.writeVint(writer, content.byteLength);
    writer.writeBytes(content);
  }

  private writeUintElement(writer: ByteWriter, id: number, value: number): void {
    let bytes = 1;
    if (value > 0xffffff) bytes = 4;
    else if (value > 0xffff) bytes = 3;
    else if (value > 0xff) bytes = 2;

    this.writeElementId(writer, id);
    this.writeVint(writer, bytes);
    for (let i = bytes - 1; i >= 0; i--) {
      writer.writeUint8((value >> (i * 8)) & 0xff);
    }
  }

  private writeFloatElement(writer: ByteWriter, id: number, value: number): void {
    this.writeElementId(writer, id);
    this.writeVint(writer, 8);
    writer.writeFloat64BE(value);
  }

  private writeStringElement(writer: ByteWriter, id: number, text: string): void {
    const bytes = new TextEncoder().encode(text);
    this.writeElementId(writer, id);
    this.writeVint(writer, bytes.byteLength);
    writer.writeBytes(bytes);
  }

  private writeElementId(writer: ByteWriter, id: number): void {
    if (id > 0xffffff) writer.writeUint32BE(id);
    else if (id > 0xffff) writer.writeUint24BE(id);
    else if (id > 0xff) writer.writeUint16BE(id);
    else writer.writeUint8(id);
  }

  private writeVint(writer: ByteWriter, value: number): void {
    if (value < 0x7f) {
      writer.writeUint8(value | 0x80);
    } else if (value < 0x3fff) {
      writer.writeUint16BE(value | 0x4000);
    } else if (value < 0x1fffff) {
      writer.writeUint24BE(value | 0x200000);
    } else if (value < 0x0fffffff) {
      writer.writeUint32BE(value | 0x10000000);
    } else {
      writer.writeUint8(0x01);
      writer.writeBytes(
        new Uint8Array([
          (value >> 24) & 0xff,
          (value >> 16) & 0xff,
          (value >> 8) & 0xff,
          value & 0xff,
        ]),
      );
    }
  }

  private patch8ByteVint(writer: ByteWriter, position: number, value: number): void {
    const bytes = new Uint8Array(8);
    bytes[0] = 0x01;
    let v = BigInt(value);
    for (let i = 7; i >= 1; i--) {
      bytes[i] = Number(v & 0xffn);
      v >>= 8n;
    }
    const arr = writer.toUint8Array();
    arr.set(bytes, position);
  }
}
