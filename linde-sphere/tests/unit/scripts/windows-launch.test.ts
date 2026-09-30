import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROJECT_ROOT } from "../../helpers/schema";

/**
 * Windows launch scripts (ADR-059). The static checks always run. The runtime checks need PowerShell
 * (`pwsh`, or PWSH_PATH) and are skipped when it is not installed; Windows PowerShell 5.1 itself, the
 * Mobile Hotspot, the firewall prompt and a physical kiosk can only be checked by hand (README, Deployment).
 */
const DIR = path.join(PROJECT_ROOT, "scripts", "windows");
const scripts = readdirSync(DIR).filter((f) => f.endsWith(".ps1"));
const source = (file: string) => readFileSync(path.join(DIR, file), "utf8");
/** Code only: comment lines and comment blocks removed. */
const code = (file: string) =>
  source(file)
    .replace(/<#[\s\S]*?#>/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");

describe("launch scripts: static checks", () => {
  it("exist: production, development-network and shared helpers", () => {
    expect(scripts.sort()).toEqual(["launch-common.ps1", "start-dev-network.ps1", "start-kiosk-server.ps1"]);
  });

  it.each(scripts)(
    "%s is ASCII-only (Windows PowerShell 5.1 reads BOM-less files in the ANSI code page)",
    (f) => {
      expect([...source(f)].filter((c) => c.charCodeAt(0) > 127)).toEqual([]);
    },
  );

  it.each(scripts)("%s uses no PowerShell 7-only syntax", (f) => {
    const text = code(f);
    expect(text).not.toMatch(/\?\?/); // null-coalescing
    expect(text).not.toMatch(/\s&&\s|\s\|\|\s/); // pipeline chains
    expect(text).not.toMatch(/\?\.\w/); // null-conditional member access
    expect(text).not.toMatch(/ForEach-Object\s+-Parallel/);
  });

  it.each(scripts)(
    "%s never changes firewall, hotspot, power, registry or execution-policy settings",
    (f) => {
      expect(code(f)).not.toMatch(
        /New-NetFirewallRule|Set-NetFirewall|Remove-NetFirewall|netsh|Set-ExecutionPolicy|powercfg|Set-ItemProperty|New-ItemProperty|Enable-NetAdapter|Disable-NetAdapter|NetworkOperatorTetheringManager|Set-NetConnectionProfile|Start-Service|Stop-Service/i,
      );
    },
  );

  it("the production script serves the production build on all adapters, with the resolved port", () => {
    const text = code("start-kiosk-server.ps1");
    expect(text).toContain("'start', '-H', '0.0.0.0', '-p'");
    expect(code("start-dev-network.ps1")).toContain("'dev', '-H', '0.0.0.0', '-p'");
    expect(code("launch-common.ps1")).toMatch(/environment variable PORT[\s\S]*PORT in \.env[\s\S]*default/);
  });

  it(".env.example documents PORT with the default value", () => {
    expect(readFileSync(path.join(PROJECT_ROOT, ".env.example"), "utf8")).toMatch(/^PORT=3000$/m);
  });
});

function findPwsh(): string | null {
  const candidates = [process.env.PWSH_PATH, "pwsh"].filter((c): c is string => Boolean(c));
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"], {
        stdio: "pipe",
      });
      return candidate;
    } catch {
      // not available
    }
  }
  return null;
}
const pwsh = findPwsh();

function run(file: string, args: string[]) {
  const result = spawnSync(pwsh!, ["-NoProfile", "-File", path.join(DIR, file), ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, "0.0.0.0", () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

describe.skipIf(!pwsh)("launch scripts: runtime checks (PowerShell available)", () => {
  it("-CheckOnly shows the URL format, the health route and the firewall note, and starts nothing", async () => {
    const port = await freePort();
    for (const file of ["start-kiosk-server.ps1", "start-dev-network.ps1"]) {
      const { output } = run(file, ["-CheckOnly", "-Port", String(port)]);
      expect(output).toContain(`Port ${port} (from parameter -Port)`);
      expect(output).toContain(`Kiosk URL format : http://<laptop-IPv4>:${port}/`);
      expect(output).toContain(`/api/health`);
      expect(output).toContain("this script does NOT change firewall rules");
      expect(output).toContain("request it from Linde IT");
      expect(output).not.toContain("Starting the");
    }
  });

  it("an invalid port is refused with an explanation", () => {
    const { status, output } = run("start-kiosk-server.ps1", ["-Port", "abc"]);
    expect(status).toBe(1);
    expect(output).toContain("Invalid port 'abc'");
  });

  it("a port already in use is reported and the server is not started", async () => {
    const server = net.createServer();
    const port = await new Promise<number>((resolve) =>
      server.listen(0, "0.0.0.0", () => resolve((server.address() as net.AddressInfo).port)),
    );
    try {
      const { status, output } = run("start-kiosk-server.ps1", ["-Port", String(port)]);
      expect(status).toBe(1);
      expect(output).toContain(`Port ${port} is already in use`);
      expect(output).toContain("The server was not started");
    } finally {
      server.close();
    }
  });
});
