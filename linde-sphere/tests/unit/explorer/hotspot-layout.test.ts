import { describe, expect, it } from "vitest";
import {
  COMPACT_BELOW_REM,
  labelRect,
  layoutHotspots,
  metricsFor,
  type LayoutItem,
} from "@/features/explorer/hotspot-layout";
import { visibleContent } from "@/domain/content";
import { loadSeedBundle } from "../../helpers/schema";

const item = (id: string, x: number, y: number, extra: Partial<LayoutItem> = {}): LayoutItem => ({
  id,
  x,
  y,
  importance: "secondary",
  label: "Etiqueta",
  labelAlways: false,
  ...extra,
});
const kiosk = metricsFor(950, 1187.5, 24);
const phone = metricsFor(358, 447.5, 16);
const toPx = (p: { x: number; y: number }, m = kiosk) => ({
  x: (p.x / 100) * m.width,
  y: (p.y / 100) * m.height,
});

function expectNoOverlap(items: LayoutItem[], m = kiosk) {
  const placed = layoutHotspots(items, m);
  placed.forEach((a, i) => {
    placed.slice(i + 1).forEach((b) => {
      const ra = m.marker[items.find((it) => it.id === a.id)!.importance] / 2;
      const rb = m.marker[items.find((it) => it.id === b.id)!.importance] / 2;
      const pa = toPx(a, m);
      const pb = toPx(b, m);
      expect(Math.hypot(pa.x - pb.x, pa.y - pb.y), `${a.id}/${b.id}`).toBeGreaterThanOrEqual(ra + rb - 0.5);
    });
  });
  return placed;
}

describe("layoutHotspots", () => {
  it("keeps well-separated hotspots exactly where they were authored", () => {
    const placed = layoutHotspots([item("a", 20, 20), item("b", 80, 70)], kiosk);
    expect(placed).toMatchObject([
      { id: "a", x: 20, y: 20, moved: false },
      { id: "b", x: 80, y: 70, moved: false },
    ]);
  });

  it("nudges overlapping markers apart by the minimum needed, symmetrically", () => {
    const placed = expectNoOverlap([item("a", 50, 50), item("b", 53, 50)]);
    expect(placed.every((p) => p.moved)).toBe(true);
    expect(placed[0]!.x).toBeLessThan(50);
    expect(placed[1]!.x).toBeGreaterThan(53);
    expect(placed[0]!.y).toBeCloseTo(50, 1);
    expect(50 - placed[0]!.x).toBeCloseTo(placed[1]!.x - 53, 1);
  });

  it("separates hotspots authored on the same point, deterministically", () => {
    const items = [item("a", 40, 40), item("b", 40, 40), item("c", 40, 40)];
    const first = expectNoOverlap(items);
    expect(layoutHotspots(items, kiosk)).toEqual(first);
  });

  it("never pushes a marker outside the art box", () => {
    const m = phone;
    const items = [item("a", 1, 1, { importance: "primary" }), item("b", 3, 2), item("c", 99, 99)];
    const placed = expectNoOverlap(items, m);
    for (const p of placed) {
      const r = m.marker[items.find((i) => i.id === p.id)!.importance] / 2;
      const { x, y } = toPx(p, m);
      expect(x).toBeGreaterThanOrEqual(r - 0.5);
      expect(y).toBeGreaterThanOrEqual(r - 0.5);
      expect(x).toBeLessThanOrEqual(m.width - r + 0.5);
      expect(y).toBeLessThanOrEqual(m.height - r + 0.5);
    }
  });

  it("places labels below by default and above near the bottom edge", () => {
    const placed = layoutHotspots([item("top", 50, 20), item("bottom", 50, 96)], kiosk);
    expect(placed.find((p) => p.id === "top")!.labelPlacement).toBe("below");
    expect(placed.find((p) => p.id === "bottom")!.labelPlacement).toBe("above");
  });

  it("aligns labels to stay inside the art box near the sides", () => {
    const long = "Área de utilidades e infraestructura";
    const placed = layoutHotspots(
      [
        item("left", 6, 30, { label: long }),
        item("mid", 50, 30, { label: "Corta" }),
        item("right", 94, 60, { label: long }),
      ],
      kiosk,
    );
    expect(placed.map((p) => p.labelAlign)).toEqual(["start", "center", "end"]);
  });

  it("moves an always-visible label away from a marker it would cover", () => {
    // B sits right under A: A's label would cover B, so A's label goes above.
    const placed = layoutHotspots(
      [
        item("a", 50, 40, { labelAlways: true, importance: "primary", label: "Sala de operaciones" }),
        item("b", 50, 48),
      ],
      kiosk,
    );
    expect(placed.find((p) => p.id === "a")!.labelPlacement).toBe("above");
  });

  it("returns the authored positions until the art box has been measured", () => {
    expect(layoutHotspots([item("a", 50, 50), item("b", 50, 50)], metricsFor(0, 0, 16))).toMatchObject([
      { x: 50, y: 50, moved: false },
      { x: 50, y: 50, moved: false },
    ]);
  });

  it.each([
    ["kiosk", kiosk],
    ["phone", phone],
  ] as const)("lays out every seed scene without overlap on a %s", (_name, m) => {
    for (const scene of visibleContent(loadSeedBundle(), "demo").scenes) {
      expectNoOverlap(
        scene.hotspots.map((h) =>
          item(h.id, h.x, h.y, { importance: h.visualImportance, label: h.label.es }),
        ),
        m,
      );
    }
  });
});

describe("metricsFor", () => {
  it("uses compact markers (never below 48 px) on small art boxes", () => {
    expect(phone.compact).toBe(true);
    expect(kiosk.compact).toBe(false);
    expect(Math.min(...Object.values(phone.marker))).toBeGreaterThanOrEqual(48);
    expect(metricsFor(COMPACT_BELOW_REM * 16, 700, 16).compact).toBe(false);
  });

  it("estimates wrapped labels when they exceed the maximum width", () => {
    const one = labelRect("Corta", 100, 100, 60, "below", "center", kiosk);
    const wrapped = labelRect("x".repeat(80), 100, 100, 60, "below", "center", kiosk);
    expect(wrapped.bottom - wrapped.top).toBeGreaterThan(one.bottom - one.top);
    expect(wrapped.right - wrapped.left).toBeLessThanOrEqual(kiosk.labelMaxWidth + 0.01);
  });
});
