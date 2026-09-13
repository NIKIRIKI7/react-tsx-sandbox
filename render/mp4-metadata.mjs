/**
 * Минимальный парсер структуры MP4 (ISO BMFF), достаточный для проверки
 * выдачи рендера: бренд, наличие moov/avc1, длительность и размеры кадра.
 * Не требует ffmpeg и работает в любом Node.js.
 */

function readBoxes(buffer, start, end) {
  const boxes = [];
  let offset = start;

  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    let headerSize = 8;

    if (size === 1) {
      size = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (size < headerSize || offset + size > end) break;

    boxes.push({
      type,
      size,
      contentStart: offset + headerSize,
      contentEnd: offset + size,
    });
    offset += size;
  }

  return boxes;
}

export function parseMp4(buffer) {
  if (buffer.length < 8 || buffer.toString('latin1', 4, 8) !== 'ftyp') {
    throw new Error('Not an MP4/ISO-BMFF file (missing ftyp box).');
  }

  const result = {
    majorBrand: null,
    brands: [],
    hasMoov: false,
    hasAvc1: false,
    timescale: null,
    duration: null,
    durationSeconds: null,
    width: null,
    height: null,
  };

  const topLevel = readBoxes(buffer, 0, buffer.length);

  const ftyp = topLevel.find((box) => box.type === 'ftyp');
  if (ftyp) {
    result.majorBrand = buffer.toString('latin1', ftyp.contentStart, ftyp.contentStart + 4);
    for (let o = ftyp.contentStart + 8; o + 4 <= ftyp.contentEnd; o += 4) {
      result.brands.push(buffer.toString('latin1', o, o + 4));
    }
  }

  const moov = topLevel.find((box) => box.type === 'moov');
  result.hasMoov = Boolean(moov);

  if (moov) {
    const moovChildren = readBoxes(buffer, moov.contentStart, moov.contentEnd);

    const mvhd = moovChildren.find((box) => box.type === 'mvhd');
    if (mvhd) {
      const version = buffer.readUInt8(mvhd.contentStart);
      if (version === 1) {
        result.timescale = buffer.readUInt32BE(mvhd.contentStart + 20);
        result.duration = Number(buffer.readBigUInt64BE(mvhd.contentStart + 24));
      } else {
        result.timescale = buffer.readUInt32BE(mvhd.contentStart + 12);
        result.duration = buffer.readUInt32BE(mvhd.contentStart + 16);
      }
      result.durationSeconds = result.duration / result.timescale;
    }

    const trak = moovChildren.find((box) => box.type === 'trak');
    if (trak) {
      const trakChildren = readBoxes(buffer, trak.contentStart, trak.contentEnd);
      const tkhd = trakChildren.find((box) => box.type === 'tkhd');
      if (tkhd) {
        const version = buffer.readUInt8(tkhd.contentStart);
        const widthOffset = version === 1 ? tkhd.contentStart + 88 : tkhd.contentStart + 76;
        result.width = buffer.readUInt32BE(widthOffset) / 65536;
        result.height = buffer.readUInt32BE(widthOffset + 4) / 65536;
      }
    }

    result.hasAvc1 = buffer.includes(Buffer.from('avc1'));
  }

  return result;
}
