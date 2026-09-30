import { describe, expect, it } from "vitest";
import { HotspotSchema, SceneSchema } from "@/domain/content";
import { informationHotspot, layer, navigationHotspot, scene, solutionHotspot } from "../../helpers/fixtures";
import { expectInvalid, expectValid } from "../../helpers/schema";

describe("HotspotSchema", () => {
  it("accepts navigation, solution and information hotspots", () => {
    expect(expectValid(HotspotSchema, navigationHotspot()).type).toBe("navigation");
    expect(expectValid(HotspotSchema, solutionHotspot()).type).toBe("solution");
    expect(expectValid(HotspotSchema, informationHotspot()).type).toBe("information");
  });

  it("accepts coordinates on the 0–100 boundaries", () => {
    expectValid(HotspotSchema, { ...informationHotspot(), x: 0, y: 100 });
  });

  it.each([
    ["x", -1],
    ["x", 100.5],
    ["y", 140],
  ])("rejects %s = %d outside 0–100", (key, value) => {
    expectInvalid(HotspotSchema, { ...informationHotspot(), [key]: value }, key);
  });

  it("rejects a hit area that overflows the scene", () => {
    expectInvalid(HotspotSchema, { ...informationHotspot(), x: 95, width: 20 }, "width", "overflows");
    expectInvalid(HotspotSchema, { ...informationHotspot(), y: 5, height: 20 }, "height", "overflows");
  });

  it("accepts an optional hit area that fits", () => {
    expectValid(HotspotSchema, { ...informationHotspot(), x: 50, y: 50, width: 20, height: 10 });
  });

  it("requires the target that matches the hotspot type", () => {
    const { targetSceneId: _t, ...noTarget } = navigationHotspot();
    expectInvalid(HotspotSchema, noTarget, "targetSceneId");
    expectInvalid(HotspotSchema, { ...solutionHotspot(), targetSolutionIds: [] }, "targetSolutionIds");
    const { panel: _p, ...noPanel } = informationHotspot();
    expectInvalid(HotspotSchema, noPanel, "panel");
  });

  it("rejects fields that belong to another hotspot type", () => {
    expectInvalid(HotspotSchema, { ...navigationHotspot(), targetSolutionIds: ["x-y"] }, "", "Unrecognized");
  });

  it("rejects an unknown type or visual importance", () => {
    expectInvalid(HotspotSchema, { ...informationHotspot(), type: "video" }, "type");
    expectInvalid(HotspotSchema, { ...informationHotspot(), visualImportance: "huge" }, "visualImportance");
  });

  it("requires an accessible label in both languages", () => {
    expectInvalid(
      HotspotSchema,
      { ...informationHotspot(), accessibleLabel: { es: "Hola" } },
      "accessibleLabel.en",
    );
  });
});

describe("SceneSchema", () => {
  it("accepts a valid child scene with foreground layers", () => {
    expectValid(SceneSchema, { ...scene(), foregroundLayers: [layer(0.4)] });
  });

  it("accepts a root scene", () => {
    expectValid(SceneSchema, {
      ...scene(),
      id: "campus",
      slug: "campus",
      parentSceneId: null,
      breadcrumb: ["campus"],
    });
  });

  it("requires the breadcrumb to end with the scene id", () => {
    expectInvalid(SceneSchema, { ...scene(), breadcrumb: ["campus"] }, "breadcrumb", "end with");
  });

  it("requires a root scene breadcrumb to contain only itself", () => {
    expectInvalid(
      SceneSchema,
      { ...scene(), parentSceneId: null, breadcrumb: ["campus", "icu"] },
      "breadcrumb",
      "root",
    );
  });

  it("rejects a scene that is its own parent", () => {
    expectInvalid(SceneSchema, { ...scene(), parentSceneId: "icu" }, "parentSceneId", "own parent");
  });

  it("requires the background layer at depth 0", () => {
    expectInvalid(SceneSchema, { ...scene(), background: layer(0.5) }, "background.depth");
  });

  it("rejects duplicate hotspot ids within a scene", () => {
    expectInvalid(
      SceneSchema,
      { ...scene(), hotspots: [informationHotspot(), informationHotspot()] },
      "hotspots[1].id",
      "Duplicate",
    );
  });

  it("rejects a navigation hotspot pointing to its own scene", () => {
    expectInvalid(
      SceneSchema,
      { ...scene(), hotspots: [{ ...navigationHotspot(), targetSceneId: "icu" }] },
      "hotspots[0].targetSceneId",
    );
  });

  it("rejects a missing background asset", () => {
    const { background: _b, ...noBackground } = scene();
    expectInvalid(SceneSchema, noBackground, "background");
  });
});
