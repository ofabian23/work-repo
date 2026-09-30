/**
 * Scans the built browser bundle for anything that must stay on the server (ADR-057): secret variable
 * names, passphrase-hash or SMTP material, server-only modules, database internals, and — when set in the
 * current environment — the actual secret values.
 *
 *   npm run build && npm run security:bundle
 *
 * Exit code 1 lists each finding (file and marker, never the secret value itself).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), ".next", "static");
if (!existsSync(root)) {
  console.error("No build found (.next/static). Run `npm run build` first.");
  process.exit(2);
}

const MARKERS: { label: string; pattern: RegExp }[] = [
  { label: "SMTP password variable", pattern: /SMTP_PASS/ },
  { label: "SMTP user variable", pattern: /SMTP_USER/ },
  { label: "admin passphrase hash variable", pattern: /ADMIN_PASSPHRASE_HASH/ },
  { label: "passphrase hash value", pattern: /scrypt:\d+:\d+:\d+:/ },
  { label: "database URL variable", pattern: /DATABASE_URL/ },
  { label: "SQLite database path", pattern: /linde-sphere\.db|e2e\.db/ },
  { label: "Prisma client", pattern: /@prisma\/client|PrismaClient/ },
  { label: "SQLite driver", pattern: /better-sqlite3/ },
  { label: "SMTP library", pattern: /nodemailer/ },
  { label: "status-token secret derivation", pattern: /lead-status:v1:/ },
  { label: "server environment schema", pattern: /EMAIL_WORKER_INTERVAL_MS|ADMIN_SESSION_MINUTES/ },
];
const SECRET_VALUES = ["SMTP_PASS", "SMTP_USER", "ADMIN_PASSPHRASE_HASH"]
  .map((name) => ({ name, value: process.env[name]?.trim() }))
  .filter((s): s is { name: string; value: string } => Boolean(s.value && s.value.length >= 6));

const findings: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(js|css|json|txt|html|map)$/.test(name)) {
      const text = readFileSync(full, "utf8");
      const rel = path.relative(process.cwd(), full);
      for (const { label, pattern } of MARKERS) if (pattern.test(text)) findings.push(`${rel}: ${label}`);
      for (const { name: variable, value } of SECRET_VALUES) {
        if (text.includes(value)) findings.push(`${rel}: value of ${variable}`);
      }
    }
  }
};
walk(root);

if (findings.length > 0) {
  console.error(`✖ Server-only material found in the client bundle:\n  ${findings.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `✔ Client bundle clean (${MARKERS.length} markers${SECRET_VALUES.length ? ` + ${SECRET_VALUES.length} secret values` : ""}).`,
);
