/**
 * Builds the optimized copies of the persona illustrations shown on the role selection screen (ADR-064).
 *
 *   npm run art:personas
 *
 * Originals live in art-source/personas/ (never served, never modified: this script only reads them). Each
 * mapped persona gets WebP copies at PERSONA_ART_WIDTHS (never above the original's width), keeping the
 * original's 2:3 proportions, in public/assets/personas/<persona-id>-<width>.webp, without metadata. It
 * prints the `illustration` entry to paste into content/personas.json; `npm run content:check` then verifies
 * every file exists and matches PERSONA_ART.
 *
 * Only originals listed in PERSONAS are published. Personas without an approved illustration keep the
 * neutral fallback tile, and unused originals stay in art-source/.
 */
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PERSONA_ART, PERSONA_ART_WIDTHS } from "../src/domain/content/persona-art";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(projectRoot, "art-source/personas");
const OUT_DIR = path.join(projectRoot, "public/assets/personas");
const WEBP = { quality: 82, effort: 6, smartSubsample: true } as const;

/** Persona id → approved original (file names exactly as delivered). */
export const PERSONAS: Record<string, string> = {
  executive: "Hospital Executive.png",
  "operations-facilities": "Facilities Director.png",
  "procurement-supply": "Procurement Leader.png",
  "clinical-respiratory": "Respiratory Therapist.png",
  "quality-compliance": "Quality Manager.png",
  finance: "Finance Leader.png",
  "technology-biomed": "Biomedical Engineer.png",
  "ambulatory-homecare": "Homecare Provider.png",
};

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let problems = 0;
  for (const [personaId, file] of Object.entries(PERSONAS)) {
    const source = path.join(SOURCE_DIR, file);
    const meta = await sharp(source).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width * PERSONA_ART.height !== height * PERSONA_ART.width) {
      console.error(
        `  ! ${personaId}: ${width} × ${height} is not ${PERSONA_ART.width}:${PERSONA_ART.height}`,
      );
      problems++;
      continue;
    }
    const srcSet: { src: string; width: number }[] = [];
    const sizes: string[] = [];
    for (const w of PERSONA_ART_WIDTHS.filter((w) => w <= width)) {
      const name = `${personaId}-${w}.webp`;
      const out = path.join(OUT_DIR, name);
      // The originals have an opaque white background; flatten keeps it white if a file ever has alpha.
      await sharp(source).flatten({ background: "#ffffff" }).resize({ width: w }).webp(WEBP).toFile(out);
      srcSet.push({ src: `/assets/personas/${name}`, width: w });
      sizes.push(`${w}w ${kb(statSync(out).size)}`);
    }
    console.log(
      `${personaId.padEnd(22)} ${file} ${width} × ${height} ${kb(statSync(source).size)} → ${sizes.join(", ")}`,
    );
    const illustration = { src: srcSet.at(-1)!.src, srcSet, assetStatus: "approved" };
    console.log(`  "illustration": ${JSON.stringify(illustration)}`);
  }
  process.exitCode = problems > 0 ? 1 : 0;
}

void main();
