import { z } from "zod";
import {
  IdSchema,
  LocalizedLabelSchema,
  LocalizedTextSchema,
  PublicPathSchema,
  SlugSchema,
  SortOrderSchema,
  ValidationStatusSchema,
} from "./primitives";

/** Visual asset status. Does NOT gate visibility (placeholder art may appear in any mode). */
export const AssetStatusSchema = z.enum(["approved", "placeholder"]);
export type AssetStatus = z.infer<typeof AssetStatusSchema>;

/** One responsive candidate of a raster scene image: the file and its real pixel width (ADR-063). */
export const SceneImageCandidateSchema = z.strictObject({
  src: PublicPathSchema,
  width: z.number().int().min(64).max(4096),
});

export const SceneLayerSchema = z
  .strictObject({
    /** The image to use when `srcSet` is not supported; with `srcSet`, its largest candidate. */
    src: PublicPathSchema,
    /**
     * Optional responsive candidates (smallest first). The browser picks one for the art box width and the
     * screen's pixel density; every candidate has the art box's proportions (checked by content:check).
     */
    srcSet: z.array(SceneImageCandidateSchema).min(1).max(6).optional(),
    alt: LocalizedTextSchema,
    /** Parallax depth: 0 = background (static), 1 = nearest foreground (moves most). */
    depth: z.number().min(0).max(1),
    assetStatus: AssetStatusSchema,
  })
  .superRefine((layer, ctx) => {
    if (!layer.srcSet) return;
    layer.srcSet.forEach((c, i) => {
      if (i > 0 && c.width <= layer.srcSet![i - 1]!.width) {
        ctx.addIssue({
          code: "custom",
          path: ["srcSet", i, "width"],
          message: "srcSet candidates must be listed from the smallest to the largest width",
        });
      }
    });
    if (layer.srcSet.at(-1)!.src !== layer.src) {
      ctx.addIssue({
        code: "custom",
        path: ["src"],
        message: "With srcSet, src must be the largest candidate (the fallback)",
      });
    }
  });
export type SceneLayer = z.infer<typeof SceneLayerSchema>;

export const VisualImportanceSchema = z.enum(["primary", "secondary", "tertiary"]);
export type VisualImportance = z.infer<typeof VisualImportanceSchema>;

/**
 * Signals a hotspot contributes when opened, beyond its own id (which rules can weight directly).
 * They connect exploration to the challenge/solution vocabulary without enumerating every hotspot in rules.
 */
export const HotspotSignalsSchema = z.strictObject({
  challengeIds: z.array(IdSchema).max(6),
  solutionIds: z.array(IdSchema).max(6),
});
export type HotspotSignals = z.infer<typeof HotspotSignalsSchema>;

export const InformationPanelSchema = z.strictObject({
  title: LocalizedLabelSchema,
  body: LocalizedTextSchema,
  bullets: z.array(LocalizedLabelSchema).max(4),
});
export type InformationPanel = z.infer<typeof InformationPanelSchema>;

/** Percentage of the scene art box, 0–100. */
const Percent = z.number().min(0).max(100);

const hotspotBase = {
  id: IdSchema,
  /** Center of the hotspot, as a percentage of the scene art box (0–100). */
  x: Percent,
  y: Percent,
  /** Optional hit-area size as a percentage of the art box; UI enforces a ≥ 64 px minimum. */
  width: Percent.positive().optional(),
  height: Percent.positive().optional(),
  label: LocalizedLabelSchema,
  accessibleLabel: LocalizedTextSchema,
  visualImportance: VisualImportanceSchema,
  recommendationSignals: HotspotSignalsSchema,
  validationStatus: ValidationStatusSchema,
};

type HotspotGeometry = { x: number; y: number; width?: number; height?: number };

function refineGeometry(h: HotspotGeometry, ctx: z.RefinementCtx): void {
  if (h.width !== undefined && (h.x - h.width / 2 < 0 || h.x + h.width / 2 > 100)) {
    ctx.addIssue({
      code: "custom",
      path: ["width"],
      message: "Hotspot box overflows the scene horizontally (x ± width/2 must stay within 0–100)",
    });
  }
  if (h.height !== undefined && (h.y - h.height / 2 < 0 || h.y + h.height / 2 > 100)) {
    ctx.addIssue({
      code: "custom",
      path: ["height"],
      message: "Hotspot box overflows the scene vertically (y ± height/2 must stay within 0–100)",
    });
  }
}

export const NavigationHotspotSchema = z
  .strictObject({ ...hotspotBase, type: z.literal("navigation"), targetSceneId: IdSchema })
  .superRefine(refineGeometry);

export const SolutionHotspotSchema = z
  .strictObject({
    ...hotspotBase,
    type: z.literal("solution"),
    targetSolutionIds: z.array(IdSchema).min(1).max(4),
  })
  .superRefine(refineGeometry);

export const InformationHotspotSchema = z
  .strictObject({ ...hotspotBase, type: z.literal("information"), panel: InformationPanelSchema })
  .superRefine(refineGeometry);

export const HotspotSchema = z.discriminatedUnion("type", [
  NavigationHotspotSchema,
  SolutionHotspotSchema,
  InformationHotspotSchema,
]);
export type Hotspot = z.infer<typeof HotspotSchema>;
export type HotspotType = Hotspot["type"];

export const SceneSchema = z
  .strictObject({
    id: IdSchema,
    slug: SlugSchema,
    title: LocalizedLabelSchema,
    description: LocalizedTextSchema,
    background: SceneLayerSchema,
    foregroundLayers: z.array(SceneLayerSchema).max(6),
    hotspots: z.array(HotspotSchema).max(24),
    parentSceneId: IdSchema.nullable(),
    /** Scene ids from the root down to and including this scene, e.g. ["campus", "icu"]. */
    breadcrumb: z.array(IdSchema).min(1).max(6),
    validationStatus: ValidationStatusSchema,
    sortOrder: SortOrderSchema,
  })
  .superRefine((scene, ctx) => {
    if (scene.breadcrumb.at(-1) !== scene.id) {
      ctx.addIssue({
        code: "custom",
        path: ["breadcrumb"],
        message: "Breadcrumb must end with the scene's own id",
      });
    }
    if (scene.parentSceneId === scene.id) {
      ctx.addIssue({ code: "custom", path: ["parentSceneId"], message: "A scene cannot be its own parent" });
    }
    if (scene.parentSceneId === null && scene.breadcrumb.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["breadcrumb"],
        message: "A root scene's breadcrumb must contain only its own id",
      });
    }
    if (scene.background.depth !== 0) {
      ctx.addIssue({ code: "custom", path: ["background", "depth"], message: "Background depth must be 0" });
    }
    const seen = new Set<string>();
    scene.hotspots.forEach((h, i) => {
      if (seen.has(h.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["hotspots", i, "id"],
          message: `Duplicate hotspot id '${h.id}'`,
        });
      }
      seen.add(h.id);
      if (h.type === "navigation" && h.targetSceneId === scene.id) {
        ctx.addIssue({
          code: "custom",
          path: ["hotspots", i, "targetSceneId"],
          message: "A navigation hotspot cannot target its own scene",
        });
      }
    });
  });
export type Scene = z.infer<typeof SceneSchema>;
