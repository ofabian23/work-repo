import "server-only";
import { crc32, deflateRawSync } from "node:zlib";

/**
 * Minimal ZIP writer for the Convention Export Package (ADR-062): deflated entries, UTF-8 names, no ZIP64
 * (a convention package is a few megabytes). Built on node:zlib only, so no archive dependency is added.
 * Opens with the archive tools built into Windows, macOS and Linux.
 */
export type ZipEntry = { name: string; data: string | Buffer };

const UTF8_NAMES = 0x0800;
const DEFLATE = 8;
const VERSION = 20;

/** MS-DOS date and time fields (2-second precision). UTC, so the same input gives the same bytes. */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.min(Math.max(date.getUTCFullYear(), 1980), 2107);
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

export function createZip(entries: ZipEntry[], modifiedAt: Date): Buffer {
  const { time, date } = dosDateTime(modifiedAt);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith("/") || entry.name.split("/").includes("..")) {
      throw new Error("Invalid ZIP entry name");
    }
    if (seen.has(entry.name)) throw new Error("Duplicate ZIP entry name");
    seen.add(entry.name);
    const name = Buffer.from(entry.name, "utf8");
    const raw = typeof entry.data === "string" ? Buffer.from(entry.data, "utf8") : entry.data;
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8_NAMES, 6);
    local.writeUInt16LE(DEFLATE, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(UTF8_NAMES, 8);
    central.writeUInt16LE(DEFLATE, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    // Extra field, comment, disk number, internal and external attributes stay 0.
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, compressed);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
