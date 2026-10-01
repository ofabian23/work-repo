import { existsSync, readFileSync, readdirSync } from "node:fs";
import { scanPublicAssets } from "./asset-safety";
import { readImageSize } from "./image-size";
import { PERSONA_ART, PERSONA_ART_RATIO } from "../../domain/content/persona-art";
import { SCENE_ART, SCENE_ART_RATIO, SCENE_ART_RATIO_TOLERANCE } from "../../domain/content/scene-art";
import path from "node:path";
import type { z } from "zod";
import {
  ContentBundleSchema,
  checkContentBundle,
  type ContentBundle,
  type ContentIssue,
  type IssueSeverity,
} from "../../domain/content/bundle";
import { EngineSettingsSchema } from "../../domain/content/engine-settings";
import { brandConfig } from "../../lib/config/brand-config";
import { BrandConfigSchema } from "../../lib/config/brand-config-schema";
import { DigitalAssetSchema, SolutionSchema } from "../../domain/content/offering";
import { RecommendationRuleSchema } from "../../domain/content/recommendation-rule";
import { SceneSchema } from "../../domain/content/scene";
import { ConsentTextSetSchema, ReportCopySchema, ContentManifestSchema } from "../../domain/content/settings";
import { ChallengeSchema, FacilityTypeSchema, PersonaSchema } from "../../domain/content/taxonomy";

/**
 * Reads every content file from disk, validates each with its Zod schema, then runs cross-record
 * checks. Node-only (uses fs); deliberately free of `server-only` so CLI scripts can use it too.
 *
 * Content is read at runtime from the project's `content/` folder (the app runs with `next start` from the
 * project root, not as a standalone/serverless bundle), so the paths are marked `turbopackIgnore` to stop
 * the bundler from tracing the whole project.
 */

export type LoadIssue = {
  severity: IssueSeverity;
  /** Path relative to the project root, e.g. `content/scenes/icu.json`. */
  file: string;
  /** Location inside the file, e.g. `hotspots[2].x`. Empty for file-level issues. */
  path: string;
  message: string;
};

export type LoadResult = {
  bundle: ContentBundle | null;
  issues: LoadIssue[];
  filesRead: string[];
};

type Collection = keyof ContentBundle;

const SINGLE_FILES: { collection: Collection; file: string; schema: z.ZodType }[] = [
  { collection: "manifest", file: "manifest.json", schema: ContentManifestSchema },
  { collection: "personas", file: "personas.json", schema: PersonaSchema.array() },
  { collection: "challenges", file: "challenges.json", schema: ChallengeSchema.array() },
  { collection: "facilityTypes", file: "facility-types.json", schema: FacilityTypeSchema.array() },
  { collection: "solutions", file: "solutions.json", schema: SolutionSchema.array() },
  { collection: "digitalAssets", file: "digital-assets.json", schema: DigitalAssetSchema.array() },
  {
    collection: "recommendationRules",
    file: "recommendation-rules.json",
    schema: RecommendationRuleSchema.array(),
  },
  { collection: "consent", file: "consent.json", schema: ConsentTextSetSchema },
  { collection: "report", file: "report.json", schema: ReportCopySchema },
  { collection: "settings", file: "engine-settings.json", schema: EngineSettingsSchema },
];
const SCENES_DIR = "scenes";

function formatPath(segments: readonly PropertyKey[]): string {
  return segments
    .map((s, i) => (typeof s === "number" ? `[${s}]` : i === 0 ? String(s) : `.${String(s)}`))
    .join("");
}

/** Converts Zod issues to load issues; for array files the record id is added for readability. */
export function zodIssuesToLoadIssues(error: z.ZodError, file: string, raw?: unknown): LoadIssue[] {
  return error.issues.map((issue) => {
    const [first] = issue.path;
    const record = Array.isArray(raw) && typeof first === "number" ? (raw[first] as unknown) : undefined;
    const id =
      record && typeof record === "object" && typeof (record as { id?: unknown }).id === "string"
        ? (record as { id: string }).id
        : undefined;
    return {
      severity: "error" as const,
      file,
      path: formatPath(issue.path),
      message: id ? `${id}: ${issue.message}` : issue.message,
    };
  });
}

export function loadContentFromDirectory(
  contentDir: string,
  { publicDir, projectRoot = path.dirname(contentDir) }: { publicDir?: string; projectRoot?: string } = {},
): LoadResult {
  const issues: LoadIssue[] = [];
  const filesRead: string[] = [];
  const rel = (abs: string) => path.relative(projectRoot, abs).split(path.sep).join("/");
  const parsed: Partial<Record<Collection, unknown>> = {};

  const readJson = (abs: string): { ok: true; value: unknown } | { ok: false } => {
    const file = rel(abs);
    if (!existsSync(abs)) {
      issues.push({ severity: "error", file, path: "", message: "File not found" });
      return { ok: false };
    }
    filesRead.push(file);
    try {
      return { ok: true, value: JSON.parse(readFileSync(abs, "utf8")) as unknown };
    } catch (err) {
      issues.push({ severity: "error", file, path: "", message: `Invalid JSON: ${(err as Error).message}` });
      return { ok: false };
    }
  };

  for (const { collection, file, schema } of SINGLE_FILES) {
    const abs = path.join(/*turbopackIgnore: true*/ contentDir, file);
    const json = readJson(abs);
    if (!json.ok) continue;
    const result = schema.safeParse(json.value);
    if (result.success) parsed[collection] = result.data;
    else issues.push(...zodIssuesToLoadIssues(result.error, rel(abs), json.value));
  }

  // Scenes: one file per scene, so errors point at the exact file.
  const scenesDir = path.join(/*turbopackIgnore: true*/ contentDir, SCENES_DIR);
  const sceneFileById = new Map<string, string>();
  const scenes: unknown[] = [];
  let scenesOk = true;
  if (!existsSync(scenesDir)) {
    issues.push({ severity: "error", file: rel(scenesDir), path: "", message: "Scenes directory not found" });
    scenesOk = false;
  } else {
    const sceneFiles = readdirSync(scenesDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    if (sceneFiles.length === 0) {
      issues.push({ severity: "error", file: rel(scenesDir), path: "", message: "No scene files found" });
      scenesOk = false;
    }
    for (const f of sceneFiles) {
      const abs = path.join(/*turbopackIgnore: true*/ scenesDir, f);
      const json = readJson(abs);
      if (!json.ok) {
        scenesOk = false;
        continue;
      }
      const result = SceneSchema.safeParse(json.value);
      if (!result.success) {
        issues.push(...zodIssuesToLoadIssues(result.error, rel(abs)));
        scenesOk = false;
        continue;
      }
      if (`${result.data.id}.json` !== f) {
        issues.push({
          severity: "error",
          file: rel(abs),
          path: "id",
          message: `Scene id '${result.data.id}' must match its file name ('${f}')`,
        });
      }
      sceneFileById.set(result.data.id, rel(abs));
      scenes.push(result.data);
    }
  }
  if (scenesOk) parsed.scenes = scenes;

  const expected: Collection[] = [...SINGLE_FILES.map((s) => s.collection), "scenes"];
  if (issues.some((i) => i.severity === "error") || expected.some((c) => !(c in parsed))) {
    return { bundle: null, issues, filesRead };
  }

  const bundleResult = ContentBundleSchema.safeParse(parsed);
  if (!bundleResult.success) {
    issues.push(...zodIssuesToLoadIssues(bundleResult.error, rel(contentDir)));
    return { bundle: null, issues, filesRead };
  }
  const bundle = bundleResult.data;

  const fileFor = (issue: ContentIssue): string => {
    if (issue.collection === "scenes") {
      return (issue.recordId && sceneFileById.get(issue.recordId)) ?? rel(scenesDir);
    }
    const single = SINGLE_FILES.find((s) => s.collection === issue.collection);
    return single ? rel(path.join(/*turbopackIgnore: true*/ contentDir, single.file)) : rel(contentDir);
  };
  for (const issue of checkContentBundle(bundle)) {
    const prefix = issue.recordId && issue.collection !== "scenes" ? `${issue.recordId}: ` : "";
    issues.push({
      severity: issue.severity,
      file: fileFor(issue),
      path: issue.path,
      message: `${prefix}${issue.message}`,
    });
  }

  // Brand values are code, not JSON, but are validated with the content so bad colors fail the same way.
  const brand = BrandConfigSchema.safeParse(brandConfig);
  if (!brand.success) issues.push(...zodIssuesToLoadIssues(brand.error, "src/lib/config/brand-config.ts"));

  if (publicDir) {
    for (const { file, message } of scanPublicAssets(publicDir, projectRoot)) {
      issues.push({ severity: "error", file, path: "", message });
    }
  }
  if (publicDir)
    issues.push(
      ...checkLocalAssetFiles(bundle, publicDir, {
        sceneFileById,
        assets: rel(path.join(/*turbopackIgnore: true*/ contentDir, "digital-assets.json")),
        personas: rel(path.join(/*turbopackIgnore: true*/ contentDir, "personas.json")),
      }),
    );

  return { bundle, issues, filesRead };
}

const publicFile = (publicDir: string, publicPath: string) =>
  path.join(/*turbopackIgnore: true*/ publicDir, ...publicPath.split("/").filter(Boolean));

type ArtRule = { ratio: number; name: string; why: string };

const SCENE_RULE: ArtRule = {
  ratio: SCENE_ART_RATIO,
  name: `the ${SCENE_ART.width} × ${SCENE_ART.height} scene art box`,
  // Hotspots are percentages of the art box: art with other proportions would misplace them (ADR-063).
  why: "or hotspots will not line up",
};
const PERSONA_RULE: ArtRule = {
  ratio: PERSONA_ART_RATIO,
  name: `the ${PERSONA_ART.width} × ${PERSONA_ART.height} persona portrait`,
  why: "or the role card would crop or stretch it",
};

/**
 * Checks every candidate of one image: the file exists, its real proportions match the rule (within 1 %),
 * and its real width matches the declared `srcSet` width. Approved art fails with errors; placeholders warn.
 */
function checkImage(
  image: { src: string; srcSet?: { src: string; width: number }[]; assetStatus: "approved" | "placeholder" },
  at: string,
  rule: ArtRule,
  report: (issue: Omit<LoadIssue, "file">) => void,
  publicDir: string,
  label = "",
) {
  const severity = image.assetStatus === "approved" ? "error" : "warning";
  const kind = image.assetStatus === "approved" ? "Approved" : "Placeholder";
  const candidates: { src: string; width?: number }[] = image.srcSet ?? [{ src: image.src }];
  candidates.forEach((candidate, i) => {
    const where = image.srcSet ? `${at}.srcSet[${i}]` : `${at}.src`;
    const file = publicFile(publicDir, candidate.src);
    if (!existsSync(file)) {
      report({ severity, path: where, message: `${label}${kind} image not found: public${candidate.src}` });
      return;
    }
    const size = readImageSize(file);
    if (!size) {
      report({ severity, path: where, message: `${label}Cannot read the size of public${candidate.src}` });
      return;
    }
    if (Math.abs(size.width / size.height / rule.ratio - 1) > SCENE_ART_RATIO_TOLERANCE) {
      report({
        severity,
        path: where,
        message: `${label}public${candidate.src} is ${size.width} × ${size.height}; it must have the proportions of ${rule.name}, ${rule.why}`,
      });
    }
    if (candidate.width !== undefined && Math.round(size.width) !== candidate.width) {
      report({
        severity: "error",
        path: `${where}.width`,
        message: `${label}srcSet says ${candidate.width} px wide but public${candidate.src} is ${size.width} px wide`,
      });
    }
  });
}

/**
 * Local files referenced by content must exist; scene art and persona illustrations must also have their
 * expected proportions (every responsive candidate, with its declared width). Problems with placeholder art
 * are warnings; with approved art, errors.
 */
function checkLocalAssetFiles(
  bundle: ContentBundle,
  publicDir: string,
  files: { sceneFileById: Map<string, string>; assets: string; personas: string },
): LoadIssue[] {
  const issues: LoadIssue[] = [];
  const exists = (publicPath: string) => existsSync(publicFile(publicDir, publicPath));
  for (const scene of bundle.scenes) {
    const file = files.sceneFileById.get(scene.id) ?? "content/scenes";
    const report = (issue: Omit<LoadIssue, "file">) => issues.push({ ...issue, file });
    checkImage(scene.background, "background", SCENE_RULE, report, publicDir);
    scene.foregroundLayers.forEach((layer, i) =>
      checkImage(layer, `foregroundLayers[${i}]`, SCENE_RULE, report, publicDir),
    );
  }
  bundle.personas.forEach((persona, i) => {
    if (!persona.illustration) return;
    const report = (issue: Omit<LoadIssue, "file">) => issues.push({ ...issue, file: files.personas });
    checkImage(
      persona.illustration,
      `[${i}].illustration`,
      PERSONA_RULE,
      report,
      publicDir,
      `${persona.id}: `,
    );
  });
  bundle.digitalAssets.forEach((asset, i) => {
    if (asset.access.kind === "local-file" && !exists(asset.access.path)) {
      issues.push({
        severity: "error",
        file: files.assets,
        path: `[${i}].access.path`,
        message: `File not found: public${asset.access.path}`,
      });
    }
  });
  return issues;
}
