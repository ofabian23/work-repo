/**
 * Minimal RFC 4180 CSV writer, Excel-friendly:
 * - UTF-8 byte-order mark so Excel shows Spanish characters correctly,
 * - CRLF line endings,
 * - fields with commas, quotes or line breaks are quoted (quotes doubled),
 * - cells that a spreadsheet could run as a formula are prefixed with an apostrophe (formula injection):
 *   a first character of = + - @, tab or CR — also after leading spaces, and in their full-width forms
 *   (＝ ＋ － ＠), which some spreadsheet programs normalize. Phone numbers such as "+1 787…" therefore
 *   appear as "'+1 787…"; the apostrophe is not shown by Excel.
 */
export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_START = /^(?:[\t\r]|[\s\u3000]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20])/;

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
