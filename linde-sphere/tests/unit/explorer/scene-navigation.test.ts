import { describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content";
import { transitionBetween } from "@/features/explorer/scene-navigation";
import { loadSeedBundle } from "../../helpers/schema";

const scenes = visibleContent(loadSeedBundle(), "demo").scenes;
const byId = new Map(scenes.map((s) => [s.id, s]));
const scene = (id: string) => byId.get(id)!;

describe("transitionBetween", () => {
  it("zooms into a child scene from the touched hotspot", () => {
    expect(transitionBetween(1, scene("campus"), "icu", byId, { x: 71, y: 15 })).toEqual({
      id: 1,
      fromSceneId: "campus",
      mode: "zoom-in",
      origin: { x: 71, y: 15 },
      panDirection: 1,
    });
  });

  it("zooms out to an ancestor, anchored where the child sits in it", () => {
    const icuEntry = scene("campus").hotspots.find((h) => h.id === "campus-to-icu")!;
    expect(transitionBetween(2, scene("icu"), "campus", byId)).toMatchObject({
      mode: "zoom-out",
      origin: { x: icuEntry.x, y: icuEntry.y },
    });
  });

  it("pans between sibling scenes, from the hotspot's side", () => {
    expect(transitionBetween(3, scene("icu"), "operating-room", byId, { x: 10, y: 45 })).toMatchObject({
      mode: "pan",
      panDirection: -1,
    });
    expect(transitionBetween(4, scene("operating-room"), "icu", byId, { x: 90, y: 45 })).toMatchObject({
      mode: "pan",
      panDirection: 1,
    });
  });

  it("does not animate towards an unknown scene", () => {
    expect(transitionBetween(5, scene("icu"), "nowhere", byId).mode).toBe("none");
  });
});
