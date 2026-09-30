import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { LeadSubmissionSchema } from "@/domain/leads/lead-submission";
import { proxy } from "@/proxy";
import { checkSvgContent, scanPublicAssets } from "@/server/content/asset-safety";
import { createDatabase } from "@/server/db/client";
import { clientKey, createRateLimiter, isAllowedHost, isSameOrigin } from "@/server/http/request-guards";
import { createPrismaLeadRepository } from "@/server/leads/lead-repository";
import { createLeadService } from "@/server/leads/lead-service";
import { handleCreateLead } from "@/server/leads/lead-http";
import nextConfig from "../../../next.config";
import { PROJECT_ROOT } from "../../helpers/schema";
import { captureLogs, demoBundle, validLead } from "../../helpers/test-database";

describe("host allowlist (DNS-rebinding protection)", () => {
  it.each([
    ["localhost:3000", true],
    ["127.0.0.1:3100", true],
    ["[::1]:3000", true],
    ["192.168.137.1:3000", true],
    ["10.0.0.5", true],
    ["172.20.1.2:3000", true],
    ["kiosk-laptop.local:3000", true],
    ["172.32.0.1", false],
    ["8.8.8.8", false],
    ["attacker.example", false],
    ["localhost.attacker.example", false],
    ["", false],
  ])("%s → %s", (host, allowed) => expect(isAllowedHost(host)).toBe(allowed));

  it("accepts extra names from ALLOWED_HOSTS", () => {
    expect(isAllowedHost("stand.linde.test:3000", ["stand.linde.test"])).toBe(true);
    expect(isAllowedHost("other.linde.test", ["stand.linde.test"])).toBe(false);
  });

  it("is enforced by the proxy for every route", () => {
    const run = (host: string, pathname = "/") =>
      proxy(new NextRequest(new URL(pathname, `http://${host}`), { headers: { host } }));
    expect(run("attacker.example", "/").status).toBe(421);
    expect(run("attacker.example", "/api/leads").status).toBe(421);
    expect(run("192.168.137.1:3000", "/").status).toBe(200);
  });
});

describe("same-origin check", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/leads", { method: "POST", headers });
  it("requires a matching Origin, or Sec-Fetch-Site same-origin when the browser hides the origin", () => {
    expect(isSameOrigin(req({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(true);
    expect(isSameOrigin(req({ host: "localhost:3000", origin: "http://evil.test" }))).toBe(false);
    expect(
      isSameOrigin(req({ host: "localhost:3000", origin: "null", "sec-fetch-site": "same-origin" })),
    ).toBe(true);
    expect(
      isSameOrigin(req({ host: "localhost:3000", origin: "null", "sec-fetch-site": "cross-site" })),
    ).toBe(false);
    expect(isSameOrigin(req({ host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ host: "localhost:3000", referer: "http://localhost:3000/" }))).toBe(true);
  });
});

describe("rate limiting", () => {
  it("limits each client and everyone together, then resets with the window", () => {
    let t = 0;
    const limiter = createRateLimiter({ windowMs: 60_000, perClient: 2, global: 3, now: () => t });
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("a")).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.take("b").allowed).toBe(true);
    expect(limiter.take("c").allowed).toBe(false); // global cap
    t = 60_000;
    expect(limiter.take("a").allowed).toBe(true);
  });

  it("keys on the client address", () => {
    const r = new Request("http://x/", { headers: { "x-forwarded-for": "192.168.137.20, 10.0.0.1" } });
    expect(clientKey(r)).toBe("192.168.137.20");
    expect(clientKey(new Request("http://x/"))).toBe("unknown");
  });
});

describe("lead submission guards and graceful failures", () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((d) => execFileSync("rm", ["-rf", d])));

  /** A service whose database file exists but was never migrated (e.g. `npm run db:deploy` was skipped). */
  function serviceWithBrokenDatabase() {
    const dir = execFileSync("mktemp", ["-d", path.join(os.tmpdir(), "linde-broken-XXXX")])
      .toString()
      .trim();
    dirs.push(dir);
    const logs = captureLogs();
    const service = createLeadService({
      leads: createPrismaLeadRepository(createDatabase(`file:${path.join(dir, "empty.db")}`)),
      content: demoBundle,
      emailProvider: "preview",
      logger: logs.logger,
      now: () => new Date("2026-10-20T14:05:00Z"),
    });
    return { service, logs };
  }
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
        ...headers,
      },
      body: JSON.stringify(body),
    });

  it("refuses cross-site submissions and rate-limits runaway clients", async () => {
    const { service, logs } = serviceWithBrokenDatabase();
    const forbidden = await handleCreateLead(
      post(validLead(), { origin: "http://evil.test" }),
      service,
      logs.logger,
      {
        requireSameOrigin: true,
      },
    );
    expect(forbidden.status).toBe(403);
    const limiter = createRateLimiter({ windowMs: 60_000, perClient: 1, global: 10 });
    await handleCreateLead(post({}), service, logs.logger, { limiter });
    const limited = await handleCreateLead(post({}), service, logs.logger, { limiter });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("answers a safe 500 without stack traces when the database is unavailable", async () => {
    const { service, logs } = serviceWithBrokenDatabase();
    const res = await handleCreateLead(post(validLead()), service, logs.logger);
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ error: "server_error" });
    expect(body).not.toMatch(/at \w|Error:|prisma|sqlite|\.ts:/i);
    expect(logs.text()).toContain("lead.store_failed");
    expect(logs.text()).not.toContain("maria.rivera");
  });
});

describe("security headers", () => {
  it("send a strict CSP and isolation headers; static assets are sandboxed", async () => {
    const rules = await nextConfig.headers!();
    const all = Object.fromEntries(
      rules.find((r) => r.source === "/:path*")!.headers.map((h) => [h.key, h.value]),
    );
    const csp = all["Content-Security-Policy"]!;
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toMatch(/https?:\/\//); // no remote origins at all (no analytics, fonts or CDNs)
    expect(all).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
    const assets = rules.find((r) => r.source === "/assets/:path*")!;
    expect(assets.headers[0]!.value).toContain("sandbox");
    expect(rules.find((r) => r.source === "/")!.headers[0]!.value).toContain("no-store");
  });
});

describe("static assets cannot carry executable content", () => {
  it.each([
    ["<svg><script>alert(1)</script></svg>", "script element"],
    ['<svg><rect onload="x()"/></svg>', "event-handler attribute"],
    ['<svg><a href="javascript:x()"/></svg>', "javascript: URL"],
    ["<svg><foreignObject><div/></foreignObject></svg>", "embedded HTML (foreignObject)"],
    ['<svg><image href="https://tracker.test/p.png"/></svg>', "external reference"],
  ])("flags %s", (svg, label) => expect(checkSvgContent(svg)).toContain(label));

  it("the shipped public/ folder is clean", () => {
    expect(scanPublicAssets(path.join(PROJECT_ROOT, "public"), PROJECT_ROOT)).toEqual([]);
    expect(checkSvgContent('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1"/></svg>')).toEqual([]);
  });
});

describe("privacy invariants", () => {
  const PATIENT =
    /patient|paciente|diagnos|medical.?record|historia.?cl[ií]nica|mrn|birth|nacimiento|ssn|seguro.?social|insurance|symptom|s[ií]ntoma|treatment|tratamiento/i;

  it("no patient-data fields exist in the database schema or the lead payload", () => {
    const schema = readFileSync(path.join(PROJECT_ROOT, "prisma", "schema.prisma"), "utf8");
    const fields = [...schema.matchAll(/^\s+(\w+)\s+[A-Z]\w*[?[\]]*\s/gm)].map((m) => m[1]!);
    expect(fields.length).toBeGreaterThan(20);
    expect(fields.filter((f) => PATIENT.test(f))).toEqual([]);
    expect(Object.keys(LeadSubmissionSchema.shape).filter((k) => PATIENT.test(k))).toEqual([]);
  });

  it("personal data files are excluded from source control", () => {
    const ignored = (file: string) => {
      try {
        execFileSync("git", ["check-ignore", "-q", file], { cwd: PROJECT_ROOT });
        return true;
      } catch {
        return false;
      }
    };
    for (const file of [
      "data/linde-sphere.db",
      "data/linde-sphere.db-wal",
      "data/email-preview/2026-x.eml",
      "data/email-preview/index.html",
      "data/backups/b.db",
      "data/exports/leads.csv",
      "exports/leads-2026.csv",
      "backup.sqlite",
      ".env",
      ".env.local",
    ]) {
      expect(ignored(file), file).toBe(true);
    }
    expect(ignored(".env.example")).toBe(false);
  });

  it("no server secrets are reachable from client code", () => {
    const files: string[] = [];
    const walk = (dir: string) =>
      readdirSync(dir).forEach((n) => {
        const full = path.join(dir, n);
        if (statSync(full).isDirectory()) {
          if (!full.includes("generated")) walk(full);
        } else if (/\.tsx?$/.test(n)) files.push(full);
      });
    walk(path.join(PROJECT_ROOT, "src"));
    const publicEnv = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/process\.env\.(NEXT_PUBLIC_\w+)/g)) publicEnv.add(m[1]!);
      if (/^["']use client["']/.test(text)) {
        expect(text, `${file} imports server code`).not.toMatch(
          /from ["']@\/server\/|from ["']@\/generated\//,
        );
      }
    }
    expect([...publicEnv]).toEqual(["NEXT_PUBLIC_APP_VERSION"]);
  });

  it("the app loads no third-party analytics or remote scripts", () => {
    const layout = readFileSync(path.join(PROJECT_ROOT, "src", "app", "layout.tsx"), "utf8");
    expect(layout).not.toMatch(/<script|googletagmanager|analytics|gtag|segment|hotjar|https?:\/\//i);
    const pkg = JSON.parse(readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(
      Object.keys(pkg.dependencies).filter((d) =>
        /analytics|gtag|segment|sentry|posthog|mixpanel|amplitude/i.test(d),
      ),
    ).toEqual([]);
  });
});
