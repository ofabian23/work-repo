/**
 * Builds the optimized, responsive copies of the approved scene illustrations (ADR-063).
 *
 *   npm run art:scenes
 *
 * Originals live in art-source/scenes/ (never served, never modified: this script only reads them). For each
 * scene it writes WebP copies at the SCENE_ART_WIDTHS that do not exceed the original's width (no upscaling),
 * keeping the original's proportions, to public/assets/scenes/approved/<scene-id>-<width>.webp. Metadata
 * (EXIF, camera or editing data) is not copied. It prints the `srcSet` entries to paste into the scene's
 * `background` in content/scenes/<scene-id>.json; `npm run content:check` then verifies every file exists and
 * matches the art box.
 *
 * Only images listed in SCENES below are published. Approved originals without a matching scene stay in
 * art-source/ until a scene is designed for them.
 */
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  SCENE_ART,
  SCENE_ART_RATIO,
  SCENE_ART_RATIO_TOLERANCE,
  SCENE_ART_WIDTHS,
} from "../src/domain/content/scene-art";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(projectRoot, "art-source/scenes/prototype1");
const OUT_DIR = path.join(projectRoot, "public/assets/scenes/approved");
const WEBP = { quality: 80, effort: 6, smartSubsample: true } as const;

/** Scene id → approved original (file names exactly as delivered). */
export const SCENES: Record<string, string> = {
  campus: "Scene 2- Hospital Campus Cutaway.jpeg",
  emergency: "Scene 3- Emergency Department.jpeg",
  icu: "Scene 4- Intensive Care Unit and NICU.jpeg",
  "operating-room": "Scene 5- Operating Room.jpeg",
  "patient-care": "Scene 6- Patient Care Areas.jpeg",
  laboratory: "Scene 7- Laboratory.jpeg",
  "gas-plant": "Scene 8- Medical Gas Plant and Exterior Suministro..jpeg",
  utilities: "Scene 9- Utility and Infrastructure Areas.jpeg",
};

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let problems = 0;
  for (const [sceneId, file] of Object.entries(SCENES)) {
    const source = path.join(SOURCE_DIR, file);
    const meta = await sharp(source).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const ratio = width / height;
    if (Math.abs(ratio / SCENE_ART_RATIO - 1) > SCENE_ART_RATIO_TOLERANCE) {
      console.error(
        `  ! ${sceneId}: ${width} × ${height} does not match the ${SCENE_ART.width} × ${SCENE_ART.height} art box`,
      );
      problems++;
      continue;
    }
    const widths = [
      ...new Set([...SCENE_ART_WIDTHS.filter((w) => w < width), Math.min(width, SCENE_ART.width)]),
    ];
    const srcSet: { src: string; width: number }[] = [];
    const sizes: string[] = [];
    for (const w of widths.sort((a, b) => a - b)) {
      const name = `${sceneId}-${w}.webp`;
      const out = path.join(OUT_DIR, name);
      await sharp(source).resize({ width: w, withoutEnlargement: true }).webp(WEBP).toFile(out);
      srcSet.push({ src: `/assets/scenes/approved/${name}`, width: w });
      sizes.push(`${w}w ${kb(statSync(out).size)}`);
    }
    console.log(
      `${sceneId.padEnd(15)} ${width} × ${height} ${meta.format} ${kb(statSync(source).size)} → ${sizes.join(", ")}`,
    );
    console.log(`  "srcSet": ${JSON.stringify(srcSet)}`);
  }
  process.exitCode = problems > 0 ? 1 : 0;
}

void main();
