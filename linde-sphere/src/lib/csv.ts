/**
 * Minimal RFC 4180 CSV writer, Excel-friendly:
 * - UTF-8 byte-order mark so Excel shows Spanish characters correctly,
 * - CRLF line endings,
 * - fields with commas, quotes or line breaks are quoted (quotes doubled),
 * - cells starting with = + - @ (or tab/CR) are prefixed with an apostrophe to block formula injection.
 */
export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][], { bom = true }: { bom?: boolean } = {}): string {
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  return `${bom ? "﻿" : ""}${body}\r\n`;
}
