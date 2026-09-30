import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";
import { adminConfig, toInternalAdminPath } from "@/server/admin/admin-config";
import { dateRange, filtersToQuery, parseAdminFilters } from "@/server/admin/admin-filters";
import { createAdminSessions, createLoginThrottle } from "@/server/admin/admin-session";
import { hashPassphrase, verifyPassphrase } from "@/server/admin/passphrase";
import { parseServerEnv } from "@/server/env";
import { proxy } from "@/proxy";

const FAST = { N: 1024, r: 8, p: 1 };

describe("admin passphrase", () => {
  it("stores only a salted scrypt hash and verifies it", async () => {
    const hash = await hashPassphrase("correcto caballo batería", FAST);
    expect(hash).toMatch(/^scrypt:1024:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain("caballo");
    expect(await hashPassphrase("correcto caballo batería", FAST)).not.toBe(hash); // random salt
    expect(await verifyPassphrase("correcto caballo batería", hash)).toBe(true);
    expect(await verifyPassphrase("correcto caballo bateria", hash)).toBe(false);
    expect(await verifyPassphrase("", hash)).toBe(false);
  });

  it("rejects short passphrases and tampered or absurd hash parameters", async () => {
    await expect(hashPassphrase("corta", FAST)).rejects.toThrow(/12/);
    const hash = await hashPassphrase("una frase suficientemente larga", FAST);
    expect(
      await verifyPassphrase(
        "una frase suficientemente larga",
        hash.replace("scrypt:1024", "scrypt:4194304"),
      ),
    ).toBe(false);
    expect(await verifyPassphrase("x", "bcrypt:whatever")).toBe(false);
  });

  it("is configured through env only as a hash; plain-text credentials are refused", () => {
    const hash = "scrypt:32768:8:1:EgSEX40CKurOTD7U7Ft6hw:sIlB1u0Wpa-gW97ZKWhfMKuM5dX_ZdPHzwkw0n3W4Sc";
    const ok = parseServerEnv({
      ADMIN_ENABLED: "true",
      ADMIN_PASSPHRASE_HASH: hash,
      ADMIN_PATH: "/gestion-local",
    });
    expect(ok.ok && adminConfig(ok.env)).toMatchObject({ enabled: true, basePath: "/gestion-local" });
    const issues = (raw: Record<string, string>) => {
      const r = parseServerEnv(raw);
      return r.ok ? [] : r.issues.map((i) => i.variable);
    };
    expect(issues({ ADMIN_ENABLED: "true" })).toContain("ADMIN_PASSPHRASE_HASH");
    expect(issues({ ADMIN_PASSPHRASE_HASH: "plain-text-password" })).toContain("ADMIN_PASSPHRASE_HASH");
    expect(issues({ ADMIN_PASSWORD: "hunter2hunter2" })).toContain("ADMIN_PASSWORD");
    expect(issues({ ADMIN_PATH: "/api" })).toContain("ADMIN_PATH");
    expect(issues({ ADMIN_PATH: "admin" })).toContain("ADMIN_PATH");
    expect(issues({ ADMIN_PATH: "/admin-console" })).toContain("ADMIN_PATH");
    const disabled = parseServerEnv({});
    expect(disabled.ok && adminConfig(disabled.env)).toMatchObject({
      enabled: false,
      basePath: "/admin-local",
    });
  });
});

describe("admin sessions and sign-in throttle", () => {
  it("expire after inactivity, slide with activity, stop at the absolute limit and can be revoked", () => {
    let t = 0;
    const sessions = createAdminSessions({ idleMs: 1_000, absoluteMs: 5_000, now: () => t });
    const token = sessions.create();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    t = 900;
    expect(sessions.validate(token)).toBe(true); // slides to 1 900
    t = 1_800;
    expect(sessions.validate(token)).toBe(true);
    t = 3_000;
    expect(sessions.validate(token)).toBe(false); // idle
    const second = sessions.create();
    for (t = 3_500; t < 8_000; t += 800) sessions.validate(second);
    expect(sessions.validate(second)).toBe(false); // absolute
    const third = sessions.create();
    sessions.revoke(third);
    expect(sessions.validate(third)).toBe(false);
    expect(sessions.validate("forged-token")).toBe(false);
    expect(sessions.validate(undefined)).toBe(false);
  });

  it("locks sign-in after five failures, doubling the wait, and resets after success", () => {
    let t = 0;
    const throttle = createLoginThrottle({ now: () => t });
    for (let i = 0; i < 4; i++) throttle.fail();
    expect(throttle.check().allowed).toBe(true);
    throttle.fail();
    expect(throttle.check()).toEqual({ allowed: false, retryAfterMs: 60_000 });
    t = 60_001;
    expect(throttle.check().allowed).toBe(true);
    throttle.fail();
    expect(throttle.check().retryAfterMs).toBe(120_000);
    throttle.succeed();
    expect(throttle.check().allowed).toBe(true);
  });
});

describe("admin filters", () => {
  it("accept only dates and known statuses; ignore anything else", () => {
    expect(
      parseAdminFilters({
        from: "2026-10-20",
        to: "2026-10-21",
        status: "active",
        delivery: "failed",
        exported: "no",
        page: "2",
      }),
    ).toEqual({
      from: "2026-10-20",
      to: "2026-10-21",
      status: "active",
      delivery: "failed",
      exported: "no",
      page: 2,
    });
    expect(
      parseAdminFilters({
        from: "yesterday",
        status: "deleted",
        delivery: "<script>",
        email: "a@b.co",
        page: "-1",
      }),
    ).toEqual({
      page: 1,
      from: undefined,
      to: undefined,
      status: undefined,
      delivery: undefined,
      exported: undefined,
    });
    expect(parseAdminFilters(new URLSearchParams("from=2026-10-22&to=2026-10-20"))).toMatchObject({
      from: "2026-10-20",
      to: "2026-10-22",
    });
  });

  it("use whole Puerto Rico days and build query strings without personal data", () => {
    expect(dateRange({ from: "2026-10-20", to: "2026-10-20" })).toEqual({
      gte: new Date("2026-10-20T04:00:00.000Z"),
      lte: new Date("2026-10-21T03:59:59.999Z"),
    });
    const query = filtersToQuery(
      { ...parseAdminFilters({ delivery: "failed", exported: "no" }), page: 3 },
      { withPage: true },
    );
    expect(query).toBe("?delivery=failed&exported=no&page=3");
  });
});

describe("CSV escaping (formula injection)", () => {
  it.each([
    ['=HYPERLINK("http://x")', '"\'=HYPERLINK(""http://x"")"'],
    ["+1 787 555 0100", "'+1 787 555 0100"],
    ["-Rivera", "'-Rivera"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["  =1+1", "'  =1+1"],
    ["\tcmd", "'\tcmd"],
    ["＝1", "'＝1"],
    ["Hospital, Metro", '"Hospital, Metro"'],
    ['María "Pepa"', '"María ""Pepa"""'],
    ["normal text", "normal text"],
    ["e-mail@x.com", "e-mail@x.com"],
  ])("%j → %j", (value, expected) => expect(escapeCsvCell(value)).toBe(expected));

  it("writes CRLF rows with a UTF-8 BOM", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["=1", "ñ"],
      ]),
    ).toBe("﻿a,b\r\n'=1,ñ\r\n");
  });
});

describe("proxy: admin route gating", () => {
  afterEach(() => vi.unstubAllEnvs());
  const HASH = "scrypt:32768:8:1:EgSEX40CKurOTD7U7Ft6hw:sIlB1u0Wpa-gW97ZKWhfMKuM5dX_ZdPHzwkw0n3W4Sc";
  const run = (path: string) => proxy(new NextRequest(new URL(path, "http://localhost:3000")));
  const rewrite = (res: Response) => res.headers.get("x-middleware-rewrite");

  it("never serves the internal admin segment directly", () => {
    vi.stubEnv("ADMIN_ENABLED", "true");
    vi.stubEnv("ADMIN_PASSPHRASE_HASH", HASH);
    expect(run("/admin-console").status).toBe(404);
    expect(run("/admin-console/leads/abc").status).toBe(404);
    expect(run("/admin-console/api/export").status).toBe(404);
  });

  it("rewrites the configured path only when admin is enabled", () => {
    vi.stubEnv("ADMIN_PATH", "/gestion-local");
    expect(rewrite(run("/gestion-local"))).toBeNull(); // disabled: falls through to the app's 404
    vi.stubEnv("ADMIN_ENABLED", "true");
    vi.stubEnv("ADMIN_PASSPHRASE_HASH", HASH);
    const res = run("/gestion-local/leads/abc");
    expect(rewrite(res)).toContain("/admin-console/leads/abc");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(rewrite(run("/gestion-localx"))).toBeNull();
    expect(rewrite(run("/admin-local"))).toBeNull(); // the default path is not active when another is set
    expect(toInternalAdminPath("/gestion-local/exports", "/gestion-local")).toBe("/admin-console/exports");
  });

  it("leaves visitor routes alone", () => {
    vi.stubEnv("ADMIN_ENABLED", "true");
    vi.stubEnv("ADMIN_PASSPHRASE_HASH", HASH);
    expect(run("/").status).toBe(200);
    expect(rewrite(run("/"))).toBeNull();
    expect(run("/api/health").status).toBe(200);
  });
});
