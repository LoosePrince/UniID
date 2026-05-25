/**
 * 从图片二进制中读取宽高（不依赖 sharp，避免引入原生依赖）。
 *
 * 支持：PNG / JPEG / GIF / WebP (VP8 / VP8L / VP8X)。
 * 对不识别格式返回 null（调用方可选填）。
 */

export interface ImageSize {
  width: number;
  height: number;
}

export function peekImageSize(buf: Buffer): ImageSize | null {
  if (buf.length < 24) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A; IHDR at offset 16
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF: GIF87a / GIF89a
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // JPEG: FF D8 ... scan for SOF (FF C0..CF except C4 C8 CC)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      // skip 0xFF padding bytes
      while (i < buf.length && buf[i] === 0xff) i++;
      const marker = buf[i++];
      if (marker === undefined) return null;
      if (marker === 0xd9 || marker === 0xda) return null; // EOI / SOS
      if (marker >= 0xd0 && marker <= 0xd7) continue; // RST markers (no length)
      if (i + 2 > buf.length) return null;
      const segLen = buf.readUInt16BE(i);
      if (
        (marker >= 0xc0 && marker <= 0xcf) &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      ) {
        // SOF: data[3..5] = height, data[5..7] = width (after segLen 2 bytes + 1 byte precision)
        if (i + 7 > buf.length) return null;
        const h = buf.readUInt16BE(i + 3);
        const w = buf.readUInt16BE(i + 5);
        return { width: w, height: h };
      }
      i += segLen;
    }
    return null;
  }

  // WebP: RIFF....WEBPVP8 / VP8L / VP8X
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    const chunk = buf.slice(12, 16).toString("ascii");
    if (chunk === "VP8 ") {
      // bytes 26..30 = width(14b) | height(14b) little endian after frame tag
      if (buf.length < 30) return null;
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      return { width: w, height: h };
    }
    if (chunk === "VP8L") {
      if (buf.length < 25) return null;
      const b1 = buf[21]!;
      const b2 = buf[22]!;
      const b3 = buf[23]!;
      const b4 = buf[24]!;
      const w = 1 + (((b2 & 0x3f) << 8) | b1);
      const h = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      return { width: w, height: h };
    }
    if (chunk === "VP8X") {
      if (buf.length < 30) return null;
      const w = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16));
      const h = 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16));
      return { width: w, height: h };
    }
  }

  return null;
}

const IMAGE_MIME_PREFIXES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
export function isImageMime(mime: string): boolean {
  return IMAGE_MIME_PREFIXES.some((p) => mime.toLowerCase().startsWith(p));
}
