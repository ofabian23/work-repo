import "server-only";
import { chmodSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import type { EmailMessage, EmailProvider } from "./email-provider";

/**
 * DevelopmentPreviewProvider (ADR-054): builds the complete MIME message exactly as SMTP would, then writes
 * it locally instead of sending it — `<stamp>-<deliveryId>.eml` (open in any mail client), `.html`
 * (open in a browser, printable) and `.txt`, plus an `index.html` listing every preview. File names carry
 * no personal data; the folder is under `data/` (git-ignored) and files are readable by the owner only.
 * Nothing leaves the machine.
 */
export class DevelopmentPreviewProvider implements EmailProvider {
  readonly name = "preview" as const;
  readonly deliversExternally = false;
  private readonly composer = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });

  constructor(
    private readonly dir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async send(message: EmailMessage, { deliveryId }: { deliveryId: string }) {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const stamp = this.now().toISOString().replace(/[:.]/g, "-");
    const base = `${stamp}-${deliveryId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const info = await this.composer.sendMail({ ...message });
    const write = (ext: string, content: string | Buffer) => {
      const file = path.join(this.dir, `${base}.${ext}`);
      writeFileSync(file, content, { mode: 0o600 });
      chmodSync(file, 0o600);
    };
    write("eml", info.message as Buffer);
    write("html", message.html);
    write("txt", message.text);
    this.writeIndex();
    return { messageId: `preview-${base}` };
  }

  /** index.html: newest first, file names only (no recipient data). */
  private writeIndex() {
    const previews = readdirSync(this.dir)
      .filter((f) => f.endsWith(".html") && f !== "index.html")
      .sort()
      .reverse();
    const rows = previews
      .map((f) => {
        const name = f.replace(/\.html$/, "");
        return `<li><a href="${name}.html">${name}</a> · <a href="${name}.txt">texto</a> · <a href="${name}.eml">.eml</a></li>`;
      })
      .join("\n");
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Linde Sphere · vista previa de correos</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.6;color:#13232F}li{margin:.25rem 0}</style></head>
<body><h1>Vista previa de correos (desarrollo)</h1>
<p>Estos correos no se enviaron: el proveedor de vista previa solo los guarda en esta carpeta. Contienen datos de contacto; no los comparta.</p>
<ul>${rows || "<li>Todavía no hay correos.</li>"}</ul></body></html>\n`;
    writeFileSync(path.join(this.dir, "index.html"), html, { mode: 0o600 });
  }
}
