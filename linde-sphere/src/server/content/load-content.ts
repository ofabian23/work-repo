import { existsSync, readFileSync, readdirSync } from "node:fs";
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
import { DigitalAssetSchema, SolutionSchema } from "../../domain/content/offering";
import { RecommendationRuleSchema } from "../../domain/content/recommendation-rule";
import { SceneSchema } from "../../domain/content/scene";
import { ConsentTextSetSchema, ContentManifestSchema } from "../../domain/content/settings";
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

  if (publicDir)
    issues.push(
      ...checkLocalAssetFiles(
        bundle,
        publicDir,
        sceneFileById,
        rel(path.join(/*turbopackIgnore: true*/ contentDir, "digital-assets.json")),
      ),
    );

  return { bundle, issues, filesRead };
}

/** Local files referenced by content must exist. Missing placeholder art is a warning, not an error. */
function checkLocalAssetFiles(
  bundle: ContentBundle,
  publicDir: string,
  sceneFileById: Map<string, string>,
  assetsFile: string,
): LoadIssue[] {
  const issues: LoadIssue[] = [];
  const exists = (publicPath: string) =>
    existsSync(path.join(/*turbopackIgnore: true*/ publicDir, ...publicPath.split("/").filter(Boolean)));
  for (const scene of bundle.scenes) {
    const layers = [
      { layer: scene.background, at: "background.src" },
      ...scene.foregroundLayers.map((layer, i) => ({ layer, at: `foregroundLayers[${i}].src` })),
    ];
    for (const { layer, at } of layers) {
      if (!exists(layer.src)) {
        issues.push({
          severity: layer.assetStatus === "approved" ? "error" : "warning",
          file: sceneFileById.get(scene.id) ?? "content/scenes",
          path: at,
          message: `${layer.assetStatus === "approved" ? "Approved" : "Placeholder"} image not found: public${layer.src}`,
        });
      }
    }
  }
  bundle.digitalAssets.forEach((asset, i) => {
    if (asset.access.kind === "local-file" && !exists(asset.access.path)) {
      issues.push({
        severity: "error",
        file: assetsFile,
        path: `[${i}].access.path`,
        message: `File not found: public${asset.access.path}`,
      });
    }
  });
  return issues;
}
