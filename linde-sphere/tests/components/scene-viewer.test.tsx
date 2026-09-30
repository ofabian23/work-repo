import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { visibleContent } from "@/domain/content/visibility";
import { SceneViewer, type SceneTransition } from "@/features/explorer/scene-viewer";
import { loadSeedBundle } from "../helpers/schema";
import { renderUi } from "./render";

const scenes = visibleContent(loadSeedBundle(), "demo").scenes;
const byId = new Map(scenes.map((s) => [s.id, s]));
const campus = byId.get("campus")!;
const gasPlant = byId.get("gas-plant")!;

afterEach(() => vi.useRealTimers());

describe("SceneViewer", () => {
  it("renders the background with its description, decorative foreground layers and every hotspot", () => {
    renderUi(<SceneViewer scene={gasPlant} scenesById={byId} onHotspot={() => undefined} />);
    const layers = screen.getByTestId("scene-layers");
    expect(within(layers).getByRole("img")).toHaveAttribute("src", gasPlant.background.src);
    expect(within(layers).getByRole("img")).toHaveAccessibleName(gasPlant.background.alt.es);
    expect(within(layers).getAllByTestId("scene-foreground")).toHaveLength(gasPlant.foregroundLayers.length);
    expect(within(layers).getByTestId("scene-foreground")).toHaveAttribute("alt", "");
    const hotspots = within(layers).getAllByRole("button");
    expect(hotspots).toHaveLength(gasPlant.hotspots.length);
    expect(new Set(hotspots.map((h) => h.dataset.hotspotType))).toEqual(
      new Set(["navigation", "information", "solution"]),
    );
  });

  it("positions hotspots by percentage of the art box", () => {
    renderUi(<SceneViewer scene={campus} scenesById={byId} onHotspot={() => undefined} />);
    for (const h of campus.hotspots) {
      expect(screen.getByTestId(`hotspot-${h.id}`)).toHaveStyle({ left: `${h.x}%`, top: `${h.y}%` });
    }
    // The art box keeps the illustrations' 4:5 ratio inside any container.
    const box = screen.getByTestId("scene-art-box");
    expect(box.style.width).toContain("100cqw");
    expect(box.style.height).toContain("100cqh");
  });

  it("reports the activated hotspot", () => {
    const onHotspot = vi.fn();
    renderUi(<SceneViewer scene={campus} scenesById={byId} onHotspot={onHotspot} />);
    fireEvent.click(screen.getByTestId("hotspot-campus-to-icu"));
    expect(onHotspot).toHaveBeenCalledWith(
      expect.objectContaining({ id: "campus-to-icu", targetSceneId: "icu" }),
    );
  });

  it("marks visited, active and relevant hotspots", () => {
    renderUi(
      <SceneViewer
        scene={campus}
        scenesById={byId}
        visitedHotspotIds={["campus-expansion"]}
        activeHotspotId="campus-supply-network"
        highlightedSceneIds={["gas-plant"]}
        highlightLabel="Relevante para usted"
        onHotspot={() => undefined}
      />,
    );
    expect(screen.getByTestId("hotspot-campus-expansion")).toHaveAttribute("data-visited", "true");
    expect(screen.getByTestId("hotspot-campus-to-gas-plant")).toHaveAccessibleName(
      "Ir a: Planta de gases medicinales · Relevante para usted",
    );
    const active = screen.getByTestId("hotspot-campus-supply-network");
    expect(within(active).getByTestId("hotspot-label").className).toContain("opacity-100");
  });

  it("shows secondary labels on touch, focus or hover only; main and wayfinding labels always", () => {
    renderUi(<SceneViewer scene={gasPlant} scenesById={byId} onHotspot={() => undefined} />);
    const info = within(screen.getByTestId("hotspot-gas-plant-perimeter")).getByTestId("hotspot-label");
    expect(info.className).toContain("opacity-0");
    expect(info.className).toContain("group-focus-visible:opacity-100");
    expect(info.className).toContain("group-active:opacity-100");
    const nav = within(screen.getByTestId("hotspot-gas-plant-to-utilities")).getByTestId("hotspot-label");
    expect(nav.className).toContain("opacity-100");
  });

  const zoomIn: SceneTransition = {
    id: 1,
    fromSceneId: "campus",
    mode: "zoom-in",
    origin: { x: 71, y: 15 },
    panDirection: 1,
  };

  it("animates a scene change with the outgoing scene, then removes it", () => {
    vi.useFakeTimers();
    renderUi(
      <SceneViewer
        scene={byId.get("icu")!}
        scenesById={byId}
        transition={zoomIn}
        onHotspot={() => undefined}
        transitionMs={500}
      />,
    );
    const outgoing = screen.getByTestId("scene-layers-outgoing");
    expect(outgoing.className).toContain("motion-safe:animate-scene-zoom-in-exit");
    expect(outgoing).toHaveAttribute("aria-hidden", "true");
    expect(outgoing.style.transformOrigin).toBe("71% 15%");
    expect(screen.getByTestId("scene-layers").className).toContain("motion-safe:animate-scene-zoom-in-enter");
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByTestId("scene-layers-outgoing")).toBeNull();
  });

  it("switches instantly with reduced motion", () => {
    renderUi(
      <SceneViewer
        scene={byId.get("icu")!}
        scenesById={byId}
        transition={zoomIn}
        reducedMotion
        onHotspot={() => undefined}
      />,
    );
    expect(screen.queryByTestId("scene-layers-outgoing")).toBeNull();
    expect(screen.getByTestId("scene-layers").className).not.toContain("animate-scene");
  });

  it("in calibration mode reports normalized coordinates instead of activating hotspots", () => {
    const onPick = vi.fn();
    renderUi(
      <SceneViewer
        scene={campus}
        scenesById={byId}
        onHotspot={() => undefined}
        calibration={{ point: null, onPick }}
      />,
    );
    expect(screen.queryByTestId("hotspot-campus-to-icu")).toBeNull();
    const overlay = screen.getByTestId("calibration-overlay");
    overlay.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 400, height: 500, right: 500, bottom: 550, x: 100, y: 50 }) as DOMRect;
    fireEvent.pointerDown(overlay, { clientX: 200, clientY: 300 });
    expect(onPick).toHaveBeenCalledWith({ x: 25, y: 50 });
    fireEvent.pointerDown(overlay, { clientX: 999, clientY: -40 });
    expect(onPick).toHaveBeenLastCalledWith({ x: 100, y: 0 });
  });
});
