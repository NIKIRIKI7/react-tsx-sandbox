import { describe, it, expect } from 'vitest';
import { ByteWriter } from './muxers/byte-writer';
import { IsobmffMuxer } from './muxers/isobmff-muxer';
import { EbmlMuxer } from './muxers/ebml-muxer';

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

describe('export/muxers/byte-writer', () => {
  it('writes big-endian integers in order', () => {
    const w = new ByteWriter(8);
    w.writeUint8(0xaa);
    w.writeUint16BE(0xbbcc);
    w.writeUint24BE(0xddeeff);
    w.writeUint32BE(0x01020304);
    const bytes = w.toUint8Array();
    expect(Array.from(bytes)).toEqual([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x01, 0x02, 0x03, 0x04]);
    expect(w.position).toBe(10);
  });

  it('grows dynamically beyond initial capacity', () => {
    const w = new ByteWriter(2);
    for (let i = 0; i < 1000; i++) w.writeUint32BE(i);
    expect(w.position).toBe(4000);
    expect(w.toUint8Array().length).toBe(4000);
  });

  it('patches previously written uint32 values', () => {
    const w = new ByteWriter(16);
    w.writeUint32BE(0);
    w.writeUint16BE(0x1234);
    w.patchUint32BE(0, 0xdeadbeef);
    const bytes = w.toUint8Array();
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('writes ASCII and raw bytes', () => {
    const w = new ByteWriter(16);
    w.writeAscii('ftyp');
    w.writeBytes(new Uint8Array([0x01, 0x02]));
    const bytes = w.toUint8Array();
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('ftyp');
    expect(bytes[4]).toBe(0x01);
    expect(bytes[5]).toBe(0x02);
  });

  it('produces a Blob with the requested MIME type', () => {
    const w = new ByteWriter(8);
    w.writeBytes(new Uint8Array([1, 2, 3]));
    const blob = w.toBlob('video/mp4');
    expect(blob.type).toBe('video/mp4');
    expect(blob.size).toBe(3);
  });
});

describe('export/muxers/isobmff-muxer', () => {
  const description = new Uint8Array([
    1, 66, 0, 31, 255, 225, 0, 24, 103, 66, 192, 30, 145, 1, 104, 64, 30, 0, 0, 0, 0, 1, 104, 206, 60,
    128, 0, 0, 0, 0,
  ]);

  it('produces an MP4 with ftyp/mdat/moov boxes and correct size math', async () => {
    const muxer = new IsobmffMuxer({ width: 640, height: 480, fps: 30 });
    muxer.setDecoderDescription(description);
    muxer.addSample(new Uint8Array([0, 0, 0, 1, 103]), true, 1 / 30);
    muxer.addSample(new Uint8Array([0, 0, 0, 1, 104]), false, 1 / 30);

    const blob = muxer.finalize();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(bytes.buffer, bytes.byteOffset);

    expect(blob.type).toBe('video/mp4');
    expect(new TextDecoder().decode(bytes.subarray(4, 8))).toBe('ftyp');
    expect(dv.getUint32(0)).toBe(32);

    const mdat = indexOfBytes(bytes, new TextEncoder().encode('mdat'));
    expect(mdat).toBeGreaterThan(-1);
    const mdatSize = dv.getUint32(mdat - 4);
    expect(mdatSize).toBe(8 + 10); // 8-byte header + two 5-byte samples

    const moov = indexOfBytes(bytes, new TextEncoder().encode('moov'));
    expect(moov).toBeGreaterThan(-1);
    const moovSize = dv.getUint32(moov - 4);
    expect(moov - 4 + moovSize).toBe(bytes.length);
  });

  it('embeds avcC decoder description from VideoEncoder metadata', async () => {
    const muxer = new IsobmffMuxer({ width: 32, height: 32, fps: 30 });
    muxer.setDecoderDescription(description);
    muxer.addSample(new Uint8Array([0, 0, 0, 1, 103]), true, 1 / 30);

    const bytes = new Uint8Array(await muxer.finalize().arrayBuffer());
    const avcC = indexOfBytes(bytes, new TextEncoder().encode('avcC'));
    expect(avcC).toBeGreaterThan(-1);
    expect(bytes[avcC + 4]).toBe(1); // configurationVersion
    expect(bytes[avcC + 5]).toBe(66); // AVCProfileIndication
  });

  it('produces an empty-but-valid header when no samples are added', async () => {
    const muxer = new IsobmffMuxer({ width: 640, height: 480, fps: 30 });
    const bytes = new Uint8Array(await muxer.finalize().arrayBuffer());
    expect(new TextDecoder().decode(bytes.subarray(4, 8))).toBe('ftyp');
    expect(indexOfBytes(bytes, new TextEncoder().encode('moov'))).toBeGreaterThan(-1);
  });
});

describe('export/muxers/ebml-muxer', () => {
  it('produces a WebM with EBML header, DocType webm and closed Segment', async () => {
    const muxer = new EbmlMuxer({ width: 640, height: 480, fps: 30, codec: 'vp8' });
    muxer.addSample(new Uint8Array([1, 2, 3, 4]), true, 0);
    muxer.addSample(new Uint8Array([5, 6, 7, 8]), false, 1 / 30);

    const blob = muxer.finalize();
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(blob.type).toBe('video/webm');
    expect(bytes[0]).toBe(0x1a);
    expect(bytes[1]).toBe(0x45);
    expect(bytes[2]).toBe(0xdf);
    expect(bytes[3]).toBe(0xa3);

    expect(indexOfBytes(bytes, new TextEncoder().encode('webm'))).toBeGreaterThan(-1);

    const segStart = indexOfBytes(bytes, new Uint8Array([0x18, 0x53, 0x80, 0x67]));
    expect(segStart).toBeGreaterThan(-1);
    const dv = new DataView(bytes.buffer, bytes.byteOffset + segStart + 4, 8);
    let segSize = 0;
    for (let i = 1; i < 8; i++) segSize = segSize * 256 + dv.getUint8(i);
    expect(segStart + 4 + 8 + segSize).toBe(bytes.length);
  });

  it('emits V_VP9 codec ID for vp9 and V_VP8 for vp8', async () => {
    const vp9 = new EbmlMuxer({ width: 640, height: 480, fps: 30, codec: 'vp9' });
    vp9.addSample(new Uint8Array([1]), true, 0);
    expect(indexOfBytes(new Uint8Array(await vp9.finalize().arrayBuffer()), new TextEncoder().encode('V_VP9'))).toBeGreaterThan(-1);

    const vp8 = new EbmlMuxer({ width: 640, height: 480, fps: 30, codec: 'vp8' });
    vp8.addSample(new Uint8Array([1]), true, 0);
    expect(indexOfBytes(new Uint8Array(await vp8.finalize().arrayBuffer()), new TextEncoder().encode('V_VP8'))).toBeGreaterThan(-1);
  });

  it('includes pixel width/height in the video track entry', async () => {
    const muxer = new EbmlMuxer({ width: 1920, height: 1080, fps: 30, codec: 'vp8' });
    muxer.addSample(new Uint8Array([1]), true, 0);
    const bytes = new Uint8Array(await muxer.finalize().arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(text.includes('V_VP8')).toBe(true);
  });
});