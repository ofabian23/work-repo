import { closeSync, openSync, readSync } from "node:fs";

/** Headers are at the start of the file; JPEG frame headers can follow large metadata blocks. */
const HEADER_BYTES = 256 * 1024;

/**
 * Reads an image's pixel size from its header, without decoding it (no image library at run time). Used by
 * `npm run content:check` to confirm scene art matches the art box (ADR-063). Supports the formats scene art
 * may use: WebP (lossy, lossless, extended), PNG, JPEG and SVG (width/height or viewBox). Returns null when
 * the size cannot be read.
 */
export type ImageSize = { width: number; height: number };

export function readImageSize(file: string): ImageSize | null {
  let fd: number | undefined;
  try {
    fd = openSync(file, "r");
    const buf = Buffer.alloc(HEADER_BYTES);
    const read = readSync(fd, buf, 0, HEADER_BYTES, 0);
    return imageSizeFromBuffer(buf.subarray(0, read));
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function imageSizeFromBuffer(buf: Buffer): ImageSize | null {
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return webpSize(buf);
  }
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString("ascii", 12, 16) === "IHDR") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) return jpegSize(buf);
  const head = buf.toString("utf8", 0, Math.min(buf.length, 4096));
  if (/<svg[\s>]/i.test(head)) return svgSize(head);
  return null;
}

function webpSize(buf: Buffer): ImageSize | null {
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    // Lossy: frame tag (3 bytes), start code 9d 01 2a, then 14-bit width and height.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  return null;
}

function jpegSize(buf: Buffer): ImageSize | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = buf.readUInt16BE(i + 2);
    // Start-of-frame markers (baseline, progressive, …) except DHT, JPG and DAC.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    i += 2 + length;
  }
  return null;
}

function svgSize(head: string): ImageSize | null {
  const tag = /<svg\b[^>]*>/i.exec(head)?.[0] ?? "";
  const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];
  const viewBox = attr("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox && viewBox.length === 4 && viewBox[2]! > 0 && viewBox[3]! > 0) {
    return { width: viewBox[2]!, height: viewBox[3]! };
  }
  const width = Number.parseFloat(attr("width") ?? "");
  const height = Number.parseFloat(attr("height") ?? "");
  return width > 0 && height > 0 ? { width, height } : null;
}
