import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";

/** CSV writer used by every export (ADR-056): RFC 4180 quoting and spreadsheet formula injection. */
describe("CSV escaping", () => {
  it.each([
    ["=SUM(A1:A2)", "'=SUM(A1:A2)"],
    ["+1 787 555 0100", "'+1 787 555 0100"],
    ["-2+3", "'-2+3"],
    ["@cmd", "'@cmd"],
    ["  =1+1", "'  =1+1"],
    ["\t=1", "'\t=1"],
    ["＝1+1", "'＝1+1"],
    ["＋1", "'＋1"],
    ["　@x", "'　@x"],
  ])("neutralizes a formula-like value %j", (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });

  it("neutralizes a leading carriage return and still quotes it", () => {
    expect(escapeCsvCell("\r=1")).toBe(`"'\r=1"`);
  });

  it("leaves ordinary text, e-mail addresses and numbers alone", () => {
    expect(escapeCsvCell("Hospital San Juan")).toBe("Hospital San Juan");
    expect(escapeCsvCell("ana@example.test")).toBe("ana@example.test");
    expect(escapeCsvCell("a-b")).toBe("a-b");
    expect(escapeCsvCell(42)).toBe("42");
  });

  it("quotes commas, quotes and line breaks, doubling inner quotes", () => {
    expect(escapeCsvCell('Clínica "Norte", PR')).toBe('"Clínica ""Norte"", PR"');
    expect(escapeCsvCell("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });

  it("combines both: a quoted formula stays neutralized", () => {
    expect(escapeCsvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
  });

  it("writes empty cells for null and undefined and yes/no for booleans", () => {
    expect([null, undefined, true, false].map(escapeCsvCell)).toEqual(["", "", "yes", "no"]);
  });

  it("uses a UTF-8 byte-order mark and CRLF line endings (Excel-friendly)", () => {
    const csv = toCsv([
      ["a", "b"],
      ["ñ", "é"],
    ]);
    expect(csv).toBe("﻿a,b\r\nñ,é\r\n");
    expect(toCsv([["a"]], { bom: false })).toBe("a\r\n");
  });
});
