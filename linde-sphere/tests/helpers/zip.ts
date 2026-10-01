import { crc32, inflateRawSync } from "node:zlib";

/**
 * Independent ZIP reader for tests: walks the central directory (as archive tools do), inflates each entry
 * and checks its CRC-32 and sizes, so the writer is verified against the format, not against itself.
 */
export function readZip(zip: Buffer): Map<string, Buffer> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("No end of central directory");
  const count = zip.readUInt16LE(end + 10);
  let p = zip.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error("Bad central directory header");
    const flags = zip.readUInt16LE(p + 8);
    const method = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    const compressedSize = zip.readUInt32LE(p + 20);
    const size = zip.readUInt32LE(p + 24);
    const nameLength = zip.readUInt16LE(p + 28);
    const extraLength = zip.readUInt16LE(p + 30);
    const commentLength = zip.readUInt16LE(p + 32);
    const offset = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLength).toString("utf8");
    if (!(flags & 0x0800)) throw new Error(`${name}: name not flagged as UTF-8`);
    if (zip.readUInt32LE(offset) !== 0x04034b50) throw new Error(`${name}: bad local header`);
    const localName = zip.readUInt16LE(offset + 26);
    const localExtra = zip.readUInt16LE(offset + 28);
    const start = offset + 30 + localName + localExtra;
    const stored = zip.subarray(start, start + compressedSize);
    const data = method === 8 ? inflateRawSync(stored) : stored;
    if (data.length !== size) throw new Error(`${name}: size mismatch`);
    if (crc32(data) !== crc) throw new Error(`${name}: CRC mismatch`);
    files.set(name, data);
    p += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
