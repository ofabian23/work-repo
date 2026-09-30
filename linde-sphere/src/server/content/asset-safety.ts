import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Static-asset safety (ADR-057). Everything under public/ is served as-is, so it must never contain
 * executable content: only allow-listed media types, and SVG files without scripts, event handlers,
 * `javascript:` links, embedded HTML or external references. Enforced by `npm run content:check`; any future
 * upload feature must apply the same rules (and re-encode raster images) before a file reaches public/.
 */
export const ALLOWED_ASSET_EXTENSIONS = [
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".pdf",
  ".mp4",
  ".webm",
];
/**
 * Size budget per file (ADR-058). Scene art is drawn at 1200 × 1500 (SCENE_ART) and shown at most ~1000 px
 * wide on the kiosk, so an optimized WebP/AVIF/PNG export fits well under 1 MB; anything larger slows scene
 * changes on the kiosk's Wi-Fi and usually means an unoptimized export.
 */
export const ASSET_SIZE_BUDGET_BYTES: Record<string, number> = {
  ".svg": 512 * 1024,
  ".png": 1024 * 1024,
  ".jpg": 1024 * 1024,
  ".jpeg": 1024 * 1024,
  ".webp": 1024 * 1024,
  ".avif": 1024 * 1024,
  ".pdf": 5 * 1024 * 1024,
  ".mp4": 20 * 1024 * 1024,
  ".webm": 20 * 1024 * 1024,
};
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/** Documentation files that may live next to assets. */
const IGNORED_FILES = new Set(["README.md", ".gitkeep"]);

const UNSAFE_SVG: { pattern: RegExp; label: string }[] = [
  { pattern: /<script\b/i, label: "script element" },
  { pattern: /\son[a-z]+\s*=/i, label: "event-handler attribute" },
  { pattern: /javascript:/i, label: "javascript: URL" },
  { pattern: /<foreignObject\b/i, label: "embedded HTML (foreignObject)" },
  { pattern: /<(iframe|embed|object)\b/i, label: "embedded document" },
  { pattern: /(?:xlink:)?href\s*=\s*["']\s*(?:https?:)?\/\//i, label: "external reference" },
  { pattern: /@import|url\(\s*["']?\s*(?:https?:)?\/\//i, label: "external stylesheet or image" },
];

export type AssetIssue = { file: string; message: string };

export function checkSvgContent(svg: string): string[] {
  return UNSAFE_SVG.filter(({ pattern }) => pattern.test(svg)).map(({ label }) => label);
}

export function scanPublicAssets(publicDir: string, projectRoot = path.dirname(publicDir)): AssetIssue[] {
  const issues: AssetIssue[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (IGNORED_FILES.has(name)) continue;
      const file = path.relative(projectRoot, full).split(path.sep).join("/");
      const ext = path.extname(name).toLowerCase();
      if (!ALLOWED_ASSET_EXTENSIONS.includes(ext)) {
        issues.push({
          file,
          message: `File type ${ext || "(none)"} is not allowed in public/ (${ALLOWED_ASSET_EXTENSIONS.join(" ")})`,
        });
        continue;
      }
      const budget = ASSET_SIZE_BUDGET_BYTES[ext]!;
      if (stat.size > budget) {
        issues.push({
          file,
          message: `File is ${kb(stat.size)}; the budget for ${ext} is ${kb(budget)} (optimize or resize the export)`,
        });
      }
      if (ext === ".svg") {
        for (const label of checkSvgContent(readFileSync(full, "utf8"))) {
          issues.push({ file, message: `Unsafe SVG content: ${label}` });
        }
      }
    }
  };
  walk(publicDir);
  return issues;
}
