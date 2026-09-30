import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROJECT_ROOT } from "../../helpers/schema";

const SRC = path.join(PROJECT_ROOT, "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return full.includes(`${path.sep}generated`) ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join("/");
const importsOf = (file: string) =>
  [...readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);

describe("layer boundaries (ADR-052)", () => {
  const all = files(SRC);

  it("only the database client, repositories and the export module import the Prisma client", () => {
    const allowed = [
      "server/db/client.ts",
      "server/leads/lead-repository.ts",
      "server/leads/email-delivery-repository.ts",
      "server/admin/admin-repository.ts",
    ];
    const offenders = all.filter(
      (f) =>
        importsOf(f).some((i) => i.includes("generated/prisma") || i.startsWith("@prisma/")) &&
        !allowed.includes(rel(f)),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("UI code (app pages, components, features) never imports the database or repositories", () => {
    const ui = all.filter(
      (f) => /^(components|features|lib)\//.test(rel(f)) || /^app\/(?!api\/)/.test(rel(f)),
    );
    const offenders = ui.filter((f) =>
      importsOf(f).some((i) => /server\/(db|leads)|generated\/prisma/.test(i)),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("route handlers use services, not repositories or the database client", () => {
    const routes = all.filter((f) => /^app\/api\//.test(rel(f)));
    const offenders = routes.filter((f) =>
      importsOf(f).some((i) =>
        /server\/db|lead-repository|email-delivery-repository|generated\/prisma/.test(i),
      ),
    );
    expect(offenders.map(rel)).toEqual([]);
  });
});
