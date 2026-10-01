/**
 * Generates the original placeholder scene illustrations in public/assets/scenes/placeholder/.
 *
 *   npm run art:placeholders                  # write the SVG files
 *   npm run art:placeholders -- --sync-content # also write hotspot anchors (x/y %) into content/scenes
 *
 * The art is intentionally simple: flat isometric boxes, cylinders and panels in the neutral placeholder
 * palette, drawn from code (no reference art is traced or imitated). Each scene registers an anchor for
 * every hotspot it depicts, so `--sync-content` keeps hotspot coordinates on top of the drawn features.
 *
 * Since ADR-063 every scene uses approved art (a different, taller ratio: SCENE_ART). These 4:5 files are
 * kept as historical placeholders and are no longer referenced; `--sync-content` refuses to touch a scene
 * whose background is approved, so it can never overwrite hotspots calibrated on approved art.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The placeholders' own canvas (4:5). Not the current art box: see SCENE_ART and ADR-063. */
const SCENE_ART = { width: 1200, height: 1500 } as const;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(projectRoot, "public/assets/scenes/placeholder");
const CONTENT_DIR = path.join(projectRoot, "content/scenes");

type Pt = readonly [number, number];
type Ramp = { top: string; left: string; right: string };

// Neutral placeholder palette (tints of the brand-config placeholder colors).
const C = {
  sky: "#E5F1F6",
  skyLow: "#F4F9FB",
  ground: "#E4ECEF",
  groundEdge: "#C9D6DE",
  grass: "#DCE9E3",
  floor: "#F4F7F9",
  floorLine: "#E2E9EE",
  wallLeft: "#E6EEF2",
  wallRight: "#D8E4EB",
  trim: "#C9D6DE",
  ink: "#13232F",
  muted: "#46596A",
  window: "#EAF4F8",
  glass: "#CFE3EC",
  white: "#FFFFFF",
  accent: "#2B8A7E",
  primary: "#0E5E78",
  signal: "#E6F4F1",
};
const R = {
  primary: { top: "#A3C3D0", left: "#6F9FB2", right: "#3F7F96" },
  primaryLight: { top: "#D2E3EA", left: "#A9C8D4", right: "#82ADBE" },
  accent: { top: "#B5D8D3", left: "#80BAB2", right: "#55A298" },
  neutral: { top: "#EEF2F5", left: "#D5DCE1", right: "#AAB6BF" },
  white: { top: "#FFFFFF", left: "#EEF3F6", right: "#D6E3EA" },
  dark: { top: "#7D8C98", left: "#5A6B79", right: "#46596A" },
  tree: { top: "#9CC9B4", left: "#7DB39B", right: "#5E9A80" },
} satisfies Record<string, Ramp>;

const COS30 = Math.cos(Math.PI / 6);
const r1 = (n: number) => Math.round(n * 10) / 10;
const pts = (list: readonly Pt[]) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");
const EDGE = ' stroke="#13232F" stroke-opacity="0.07" stroke-width="2" stroke-linejoin="round"';

/** Isometric drawing surface: floor coordinates (a, b) and height z, scaled by `s`. */
class Scene {
  private parts: string[] = [];
  readonly anchors = new Map<string, Pt>();
  constructor(
    readonly ox: number,
    readonly oy: number,
    readonly s = 1,
  ) {}

  p(a: number, b: number, z = 0): Pt {
    return [this.ox + (a - b) * COS30 * this.s, this.oy + ((a + b) * 0.5 - z) * this.s];
  }
  raw(svg: string) {
    this.parts.push(svg);
  }
  poly(list: readonly Pt[], fill: string, extra = EDGE) {
    this.raw(`<polygon points="${pts(list)}" fill="${fill}"${extra}/>`);
  }
  line(list: readonly Pt[], stroke: string, width = 4, extra = "") {
    this.raw(
      `<polyline points="${pts(list)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`,
    );
  }
  anchor(id: string, pt: Pt) {
    this.anchors.set(id, pt);
  }

  /** Floor-aligned box centered on (a, b): w along a, d along b, h tall, base at z. Returns the top center. */
  box(a: number, b: number, w: number, d: number, h: number, ramp: Ramp, z = 0): Pt {
    const P = (da: number, db: number, dz: number) => this.p(a + da, b + db, z + dz);
    const hw = w / 2;
    const hd = d / 2;
    this.poly([P(-hw, hd, 0), P(hw, hd, 0), P(hw, hd, h), P(-hw, hd, h)], ramp.left);
    this.poly([P(hw, hd, 0), P(hw, -hd, 0), P(hw, -hd, h), P(hw, hd, h)], ramp.right);
    this.poly([P(-hw, -hd, h), P(hw, -hd, h), P(hw, hd, h), P(-hw, hd, h)], ramp.top);
    return this.p(a, b, z + h);
  }

  /** Rows of windows on the two visible faces of a box drawn with `box`. */
  windows(a: number, b: number, w: number, d: number, h: number, rows: number, fill = C.window, z = 0) {
    const hw = w / 2;
    const hd = d / 2;
    const rowH = h / (rows + 1);
    for (let r = 0; r < rows; r++) {
      const z0 = z + rowH * (r + 0.55);
      const z1 = z0 + rowH * 0.5;
      for (let u = 0.12; u < 0.9; u += 0.22) {
        const u1 = u + 0.12;
        this.poly(
          [
            this.p(a - hw + u * w, b + hd, z0),
            this.p(a - hw + u1 * w, b + hd, z0),
            this.p(a - hw + u1 * w, b + hd, z1),
            this.p(a - hw + u * w, b + hd, z1),
          ],
          fill,
          "",
        );
        this.poly(
          [
            this.p(a + hw, b + hd - u * d, z0),
            this.p(a + hw, b + hd - u1 * d, z0),
            this.p(a + hw, b + hd - u1 * d, z1),
            this.p(a + hw, b + hd - u * d, z1),
          ],
          fill,
          ' fill-opacity="0.85"',
        );
      }
    }
  }

  /** Vertical cylinder standing on (a, b). Returns the top center. */
  cylinder(a: number, b: number, r: number, h: number, ramp: Ramp, z = 0): Pt {
    const [cx, by] = this.p(a, b, z);
    const ty = by - h * this.s;
    const rx = r * 1.2247 * this.s;
    const ry = r * 0.7071 * this.s;
    const n = (v: number) => r1(v);
    this.raw(
      `<path d="M${n(cx - rx)} ${n(ty)} L${n(cx - rx)} ${n(by)} A${n(rx)} ${n(ry)} 0 0 0 ${n(cx + rx)} ${n(by)} L${n(cx + rx)} ${n(ty)} Z" fill="${ramp.left}"${EDGE}/>`,
    );
    this.raw(
      `<path d="M${n(cx)} ${n(ty + ry)} L${n(cx)} ${n(by + ry)} A${n(rx)} ${n(ry)} 0 0 0 ${n(cx + rx)} ${n(by)} L${n(cx + rx)} ${n(ty)} A${n(rx)} ${n(ry)} 0 0 1 ${n(cx)} ${n(ty + ry)} Z" fill="${ramp.right}"/>`,
    );
    this.raw(`<ellipse cx="${n(cx)}" cy="${n(ty)}" rx="${n(rx)}" ry="${n(ry)}" fill="${ramp.top}"${EDGE}/>`);
    return [cx, ty];
  }

  /** Rectangle on the left wall plane (a = constant), spanning b0–b1 and z0–z1. Returns its center. */
  leftWallRect(a: number, b0: number, b1: number, z0: number, z1: number, fill: string, extra = EDGE): Pt {
    this.poly([this.p(a, b1, z0), this.p(a, b0, z0), this.p(a, b0, z1), this.p(a, b1, z1)], fill, extra);
    return this.p(a, (b0 + b1) / 2, (z0 + z1) / 2);
  }

  /** Rectangle on the right wall plane (b = constant), spanning a0–a1 and z0–z1. Returns its center. */
  rightWallRect(b: number, a0: number, a1: number, z0: number, z1: number, fill: string, extra = EDGE): Pt {
    this.poly([this.p(a0, b, z0), this.p(a1, b, z0), this.p(a1, b, z1), this.p(a0, b, z1)], fill, extra);
    return this.p((a0 + a1) / 2, b, (z0 + z1) / 2);
  }

  tree(a: number, b: number, size = 60) {
    const [x, y] = this.p(a, b, 0);
    const sz = size * this.s;
    this.raw(
      `<rect x="${r1(x - sz * 0.08)}" y="${r1(y - sz * 0.9)}" width="${r1(sz * 0.16)}" height="${r1(sz * 0.9)}" rx="${r1(sz * 0.05)}" fill="#8A9A8F"/>`,
    );
    this.raw(
      `<ellipse cx="${r1(x)}" cy="${r1(y - sz * 1.2)}" rx="${r1(sz * 0.62)}" ry="${r1(sz * 0.7)}" fill="${R.tree.left}"/>`,
    );
    this.raw(
      `<ellipse cx="${r1(x + sz * 0.15)}" cy="${r1(y - sz * 1.35)}" rx="${r1(sz * 0.35)}" ry="${r1(sz * 0.38)}" fill="${R.tree.top}"/>`,
    );
  }

  svg(background: string | null): string {
    const bg = background
      ? `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sky}"/><stop offset="1" stop-color="${C.skyLow}"/></linearGradient></defs><rect width="${SCENE_ART.width}" height="${SCENE_ART.height}" fill="${background}"/>`
      : "";
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_ART.width} ${SCENE_ART.height}" width="${SCENE_ART.width}" height="${SCENE_ART.height}">`,
      "<!-- Linde Sphere placeholder illustration: original artwork generated by scripts/placeholder-art.ts -->",
      bg,
      ...this.parts,
      "</svg>",
      "",
    ].join("\n");
  }
}

// ---- Interior rooms --------------------------------------------------------------------------

const ROOM = { half: 340, height: 460 };

function room(): Scene {
  const s = new Scene(600, 900);
  const h = ROOM.half;
  s.raw(`<rect width="${SCENE_ART.width}" height="${SCENE_ART.height}" fill="${C.skyLow}"/>`);
  s.poly([s.p(-h, -h), s.p(h, -h), s.p(h, h), s.p(-h, h)], C.floor);
  for (let t = -h + 85; t < h; t += 85) {
    s.line([s.p(t, -h), s.p(t, h)], C.floorLine, 2);
    s.line([s.p(-h, t), s.p(h, t)], C.floorLine, 2);
  }
  s.poly([s.p(-h, h), s.p(-h, -h), s.p(-h, -h, ROOM.height), s.p(-h, h, ROOM.height)], C.wallLeft);
  s.poly([s.p(-h, -h), s.p(h, -h), s.p(h, -h, ROOM.height), s.p(-h, -h, ROOM.height)], C.wallRight);
  s.leftWallRect(-h, -h, h, 0, 26, C.trim, "");
  s.rightWallRect(-h, -h, h, 0, 26, C.trim, "");
  return s;
}

/** Door in the left wall with a small wayfinding sign (an arrow). Returns the anchor. */
function leftDoor(s: Scene, b0: number, b1: number): Pt {
  const a = -ROOM.half;
  s.leftWallRect(a, b0 - 12, b1 + 12, 0, 272, C.muted, "");
  const center = s.leftWallRect(a, b0, b1, 0, 260, "#AAB6BF", "");
  s.leftWallRect(a, (b0 + b1) / 2 - 3, (b0 + b1) / 2 + 3, 20, 250, "#8C9AA5", "");
  const signB0 = b0 + 10;
  const signB1 = b1 - 10;
  s.leftWallRect(a, signB0, signB1, 300, 350, C.accent, "");
  const mid = (signB0 + signB1) / 2;
  s.line([s.p(a, mid + 22, 325), s.p(a, mid - 18, 325)], C.white, 6);
  s.line([s.p(a, mid - 2, 338), s.p(a, mid - 18, 325), s.p(a, mid - 2, 312)], C.white, 6);
  return [center[0], center[1] - 20];
}

/** Door in the right wall with a wayfinding sign. Returns the anchor. */
function rightDoor(s: Scene, a0: number, a1: number): Pt {
  const b = -ROOM.half;
  s.rightWallRect(b, a0 - 12, a1 + 12, 0, 272, C.muted, "");
  const center = s.rightWallRect(b, a0, a1, 0, 260, "#AAB6BF", "");
  s.rightWallRect(b, (a0 + a1) / 2 - 3, (a0 + a1) / 2 + 3, 20, 250, "#8C9AA5", "");
  s.rightWallRect(b, a0 + 10, a1 - 10, 300, 350, C.accent, "");
  const mid = (a0 + a1) / 2;
  s.line([s.p(mid - 22, b, 325), s.p(mid + 18, b, 325)], C.white, 6);
  s.line([s.p(mid + 2, b, 338), s.p(mid + 18, b, 325), s.p(mid + 2, b, 312)], C.white, 6);
  return [center[0], center[1] - 20];
}

/** Bed or stretcher: frame, mattress and pillow. Long side along `axis`. Returns the mattress top. */
function bed(s: Scene, a: number, b: number, axis: "a" | "b", ramp: Ramp = R.neutral): Pt {
  const [w, d] = axis === "a" ? [210, 110] : [110, 210];
  s.box(a, b, w * 0.9, d * 0.9, 55, ramp!);
  const top = s.box(a, b, w, d, 22, R.white, 55);
  const pillow = axis === "a" ? ([a - w / 2 + 30, b] as const) : ([a, b - d / 2 + 30] as const);
  s.box(pillow[0], pillow[1], axis === "a" ? 40 : 80, axis === "a" ? 80 : 40, 12, R.primaryLight, 77);
  return top;
}

/** A labeled wall panel (board, screen, headwall) made of a frame and simple content lines. */
function panelOnRight(
  s: Scene,
  a0: number,
  a1: number,
  z0: number,
  z1: number,
  face: string,
  lines: string,
): Pt {
  const b = -ROOM.half;
  s.rightWallRect(b, a0 - 8, a1 + 8, z0 - 8, z1 + 8, C.muted, "");
  const center = s.rightWallRect(b, a0, a1, z0, z1, face, "");
  const rows = 3;
  for (let i = 1; i <= rows; i++) {
    const z = z0 + ((z1 - z0) * i) / (rows + 1);
    const len = (a1 - a0) * (0.45 + 0.15 * (i % 3));
    s.line([s.p(a0 + 16, b, z), s.p(a0 + 16 + len, b, z)], lines, 8);
  }
  return center;
}

function panelOnLeft(
  s: Scene,
  b0: number,
  b1: number,
  z0: number,
  z1: number,
  face: string,
  lines: string,
): Pt {
  const a = -ROOM.half;
  s.leftWallRect(a, b0 - 8, b1 + 8, z0 - 8, z1 + 8, C.muted, "");
  const center = s.leftWallRect(a, b0, b1, z0, z1, face, "");
  for (let i = 1; i <= 3; i++) {
    const z = z0 + ((z1 - z0) * i) / 4;
    const len = (b1 - b0) * (0.45 + 0.15 * (i % 3));
    s.line([s.p(a, b1 - 16, z), s.p(a, b1 - 16 - len, z)], lines, 8);
  }
  return center;
}

const above = ([x, y]: Pt, px: number): Pt => [x, y - px];

function emergency(): Scene {
  const s = room();
  // Triage / surge board on the back-right wall.
  s.anchor("emergency-surge-readiness", panelOnRight(s, -230, -40, 200, 330, C.white, C.accent));
  // Oxygen outlets along the right wall.
  for (const a of [40, 90]) s.rightWallRect(-ROOM.half, a, a + 26, 150, 176, C.accent, "");
  s.anchor("emergency-to-icu", leftDoor(s, 40, 190));
  bed(s, 60, -190, "b");
  // Stretcher with an oxygen cylinder cart.
  bed(s, -120, 60, "b");
  s.box(150, 20, 70, 70, 30, R.dark);
  const cyl = s.cylinder(150, 20, 18, 150, R.accent, 30);
  s.anchor("emergency-critical-gases", above(cyl, 40));
  // Nurses' station.
  s.box(170, 220, 230, 90, 105, R.primaryLight);
  s.box(120, 220, 40, 60, 50, R.dark, 105);
  return s;
}

function icu(): Scene {
  const s = room();
  s.anchor("icu-bedside-supply", panelOnRight(s, -230, -90, 130, 250, C.primary, C.glass));
  s.anchor("icu-monitoring", panelOnRight(s, 120, 250, 260, 360, "#1E3344", "#7FD3C1"));
  s.anchor("icu-to-operating-room", leftDoor(s, 140, 280));
  bed(s, -160, -220, "b");
  s.cylinder(-60, -280, 14, 120, R.accent);
  const b2 = bed(s, 110, -210, "b");
  s.box(200, -280, 40, 40, 140, R.dark);
  s.anchor("icu-clinical-oxygen", above(b2, 30));
  // Visitor chair and supply cart.
  s.box(-40, 140, 80, 80, 60, R.primaryLight);
  s.box(190, 150, 110, 70, 90, R.neutral);
  return s;
}

function operatingRoom(): Scene {
  const s = room();
  s.anchor("or-infrastructure", panelOnLeft(s, -80, 60, 150, 260, "#F3F7F9", C.accent));
  s.anchor("operating-room-to-icu", rightDoor(s, 140, 280));
  // Operating table.
  s.box(0, 40, 60, 160, 90, R.neutral);
  s.box(0, 40, 90, 230, 16, R.primaryLight, 90);
  // Ceiling pendant with gas outlets.
  const pendantTop = s.p(-200, -200, ROOM.height);
  const pendantArm = s.p(-200, -200, 340);
  s.line([pendantTop, pendantArm], C.muted, 10);
  const pendant = s.box(-200, -200, 70, 70, 110, R.primary, 230);
  s.anchor("or-gas-outlets", [pendant[0], pendant[1] + 60]);
  // Surgical light.
  const light = s.p(10, 70, 300);
  s.line([s.p(10, 70, ROOM.height), light], C.muted, 8);
  s.raw(
    `<ellipse cx="${r1(light[0])}" cy="${r1(light[1])}" rx="78" ry="42" fill="${C.white}" stroke="${C.trim}" stroke-width="6"/>`,
  );
  // Anesthesia machine.
  s.box(170, 140, 80, 80, 170, R.white);
  s.box(170, 140, 60, 10, 50, R.dark, 120);
  return s;
}

function patientCare(): Scene {
  const s = room();
  s.anchor("patient-care-to-emergency", rightDoor(s, -290, -170));
  // Three beds along the left wall.
  for (const b of [-150, 40, 230]) bed(s, -230, b, "a");
  // Cylinder rack against the right wall.
  s.box(90, -290, 170, 50, 30, R.dark);
  let rackTop: Pt = [0, 0];
  for (const a of [30, 70, 110, 150]) rackTop = s.cylinder(a, -290, 15, 140, R.accent, 30);
  s.anchor("patient-care-cylinders", above([rackTop[0] - 50, rackTop[1]], 30));
  // Storage shelves (inventory).
  const shelf = s.box(270, -280, 110, 60, 240, R.white);
  for (const z of [60, 120, 180]) s.box(270, -280, 112, 62, 6, R.neutral, z);
  s.anchor("patient-care-inventory", above(shelf, 20));
  // Discharge area: portable kit and wheelchair.
  const kit = s.box(170, 190, 80, 60, 90, R.accent);
  s.box(60, 230, 70, 70, 45, R.dark);
  s.box(30, 230, 12, 70, 70, R.dark, 45);
  s.anchor("patient-care-discharge", above(kit, 30));
  return s;
}

function laboratory(): Scene {
  const s = room();
  s.anchor("lab-to-gas-plant", leftDoor(s, 150, 290));
  // Fume hood on the left wall.
  s.box(-300, -120, 80, 170, 260, R.white);
  s.leftWallRect(-260, -190, -50, 110, 230, C.glass, "");
  // Chained cylinders against the right wall.
  s.rightWallRect(-ROOM.half, -125, 15, 120, 130, C.muted, "");
  let mid: Pt = [0, 0];
  for (const [i, a] of [-100, -55, -10].entries()) {
    const top = s.cylinder(a, -305, 16, 190, i === 1 ? R.primary : R.accent);
    if (i === 1) mid = top;
  }
  s.anchor("lab-gas-supply", above(mid, 30));
  // Safety cabinet.
  const cabinet = s.box(210, -290, 110, 60, 220, R.primaryLight);
  s.anchor("lab-safe-handling", above(cabinet, 20));
  // Bench with instruments.
  s.box(-20, 110, 380, 90, 100, R.neutral);
  s.box(-120, 110, 60, 50, 60, R.primary, 100);
  s.box(10, 110, 50, 50, 40, R.white, 100);
  s.box(110, 110, 70, 50, 50, R.accent, 100);
  return s;
}

function utilities(): Scene {
  const s = room();
  // Pipe runs along the right wall.
  for (const [z, color] of [
    [390, C.accent],
    [425, C.primary],
  ] as const) {
    s.line([s.p(-ROOM.half, -ROOM.half + 20, z), s.p(ROOM.half, -ROOM.half + 20, z)], color, 12);
  }
  s.anchor("utilities-alarm-panel", panelOnRight(s, 110, 230, 190, 290, "#1E3344", "#7FD3C1"));
  s.anchor("utilities-to-gas-plant", leftDoor(s, -10, 120));
  // Manifold enclosure.
  const enclosure = s.box(-210, -210, 170, 170, 220, R.primary);
  s.box(-210, -210, 172, 172, 10, R.primaryLight, 220);
  s.anchor("utilities-manifold-room", above(enclosure, 30));
  // Valve station (maintenance).
  const skid = s.box(90, 60, 210, 120, 90, R.neutral);
  for (const a of [30, 90, 150]) s.cylinder(a, 60, 12, 110, R.accent, 90);
  s.anchor("utilities-maintenance", above(skid, 110));
  // Training board on an easel.
  const board = s.box(-70, 240, 16, 150, 200, R.white);
  s.box(-70, 240, 18, 150, 8, R.neutral, 60);
  s.anchor("utilities-safety-training", above(board, 10));
  return s;
}

// ---- Outdoor scenes ----------------------------------------------------------------------------

function ground(s: Scene, half: number, fill: string) {
  s.poly([s.p(-half, -half), s.p(half, -half), s.p(half, half), s.p(-half, half)], fill);
}

function gasPlant(): Scene {
  const s = new Scene(600, 930);
  ground(s, 700, C.grass);
  // Concrete pad.
  s.box(0, -60, 560, 520, 12, R.neutral);
  // Small utilities building at the edge (navigation).
  const util = s.box(450, 420, 200, 160, 150, R.primaryLight);
  s.windows(450, 420, 200, 160, 150, 1);
  s.anchor("gas-plant-to-utilities", above(util, 30));
  // Pipe towards the hospital (behind the tank).
  s.line([s.p(-60, -150, 60), s.p(-60, -400, 60), s.p(-400, -400, 60)], C.muted, 10);
  // Bulk tank.
  s.box(-60, -150, 110, 110, 40, R.dark, 12);
  const tankTop = s.cylinder(-60, -150, 78, 430, R.white, 52);
  s.anchor("gas-plant-bulk-tank", [tankTop[0], tankTop[1] + 200]);
  // Vaporizers.
  for (const b of [-230, -140]) {
    s.box(170, b, 60, 60, 250, R.neutral, 12);
    for (let z = 40; z < 250; z += 40) s.box(170, b, 64, 64, 4, R.white, 12 + z);
  }
  // Backup cylinder bank.
  s.box(150, 130, 200, 90, 16, R.dark, 12);
  let backupTop: Pt = [0, 0];
  for (const a of [80, 120, 160, 200]) backupTop = s.cylinder(a, 130, 16, 150, R.accent, 28);
  s.anchor("gas-plant-backup", above([backupTop[0] - 45, backupTop[1]], 40));
  // Perimeter sign.
  const post = s.p(-230, 180, 0);
  s.line([post, s.p(-230, 180, 200)], C.muted, 8);
  const sign = s.leftWallRect(-230, 120, 240, 150, 240, C.white, EDGE);
  s.leftWallRect(-230, 140, 220, 170, 220, C.accent, "");
  s.anchor("gas-plant-perimeter", above(sign, 0));
  return s;
}

function gasPlantForeground(): Scene {
  const s = new Scene(600, 930);
  // Fence along the front edge, drawn over the scene.
  const b = 470;
  for (let a = -700; a <= 500; a += 80) s.line([s.p(a, b, 0), s.p(a, b, 110)], "#8C9AA5", 7);
  for (const z of [40, 95]) s.line([s.p(-700, b, z), s.p(500, b, z)], "#AAB6BF", 4);
  s.tree(560, 380, 90);
  s.tree(-620, 520, 110);
  return s;
}

function campus(): Scene {
  const s = new Scene(600, 840, 0.62);
  ground(s, 1150, C.grass);
  // Roads.
  s.poly([s.p(-1150, 420), s.p(1150, 420), s.p(1150, 500), s.p(-1150, 500)], "#D5DCE1", "");
  s.poly([s.p(40, -1150), s.p(120, -1150), s.p(120, 1150), s.p(40, 1150)], "#D5DCE1", "");
  // Back row.
  const icuTop = s.box(-150, -620, 280, 240, 560, R.primary);
  s.windows(-150, -620, 280, 240, 560, 6);
  s.anchor("campus-to-icu", above(icuTop, 30));
  const edTop = s.box(-640, -120, 320, 270, 210, R.primaryLight);
  s.windows(-640, -120, 320, 270, 210, 2);
  s.box(-470, -100, 60, 150, 10, R.accent, 150);
  s.box(-430, -40, 90, 50, 50, R.white);
  s.anchor("campus-to-emergency", above(edTop, 40));
  const labTop = s.box(420, -330, 290, 250, 250, R.primaryLight);
  s.windows(420, -330, 290, 250, 250, 2);
  s.anchor("campus-to-laboratory", above(labTop, 30));
  // Main building (operating rooms).
  const orTop = s.box(-170, -200, 330, 300, 380, R.primary);
  s.windows(-170, -200, 330, 300, 380, 4);
  s.anchor("campus-to-operating-room", above(orTop, 30));
  // Patient-care wing.
  const pcTop = s.box(-500, 330, 270, 360, 270, R.primaryLight);
  s.windows(-500, 330, 270, 360, 270, 3);
  s.anchor("campus-to-patient-care", above(pcTop, 30));
  // Expansion site: dashed outline and a simple crane.
  const site = [s.p(170, 90), s.p(470, 90), s.p(470, 350), s.p(170, 350)];
  s.poly(site, "#EEF2F5", ' stroke="#46596A" stroke-width="4" stroke-dasharray="14 10"');
  const mast = s.p(420, 150, 0);
  s.line([mast, s.p(420, 150, 360)], "#E0A43A", 10);
  s.line([s.p(420, 150, 360), s.p(220, 150, 360)], "#E0A43A", 8);
  s.line([s.p(250, 150, 360), s.p(250, 150, 220)], C.muted, 3);
  s.anchor("campus-expansion", s.p(300, 230, 80));
  // Utilities building.
  const utTop = s.box(620, 330, 260, 200, 170, R.neutral);
  s.cylinder(690, 290, 22, 150, R.dark, 170);
  s.anchor("campus-to-utilities", above(utTop, 30));
  // Gas plant and supply network.
  s.line([s.p(-160, 700, 20), s.p(-160, 330, 20), s.p(-170, -40, 20)], C.accent, 9);
  const valve = s.box(-160, 380, 70, 70, 50, R.accent);
  s.anchor("campus-supply-network", above(valve, 20));
  s.box(-130, 780, 300, 240, 12, R.neutral);
  s.cylinder(-200, 760, 55, 300, R.white, 12);
  const gasTop = s.cylinder(-60, 800, 40, 220, R.white, 12);
  s.anchor("campus-to-gas-plant", above(gasTop, 50));
  // Trees.
  for (const [a, b] of [
    [300, -800],
    [700, -600],
    [-900, 200],
    [300, 650],
    [800, 50],
  ] as const) {
    s.tree(a, b, 90);
  }
  return s;
}

function campusForeground(): Scene {
  const s = new Scene(600, 840, 0.62);
  for (const [a, b, size] of [
    [-1000, 950, 150],
    [-760, 1080, 120],
    [900, 900, 140],
    [1100, 700, 120],
  ] as const) {
    s.tree(a, b, size);
  }
  return s;
}

// ---- Output -----------------------------------------------------------------------------------

type Output = { file: string; scene: Scene; sceneId?: string; background: string | null };

const outputs: Output[] = [
  { file: "campus-background.svg", scene: campus(), sceneId: "campus", background: "url(#sky)" },
  { file: "campus-foreground.svg", scene: campusForeground(), background: null },
  { file: "emergency-background.svg", scene: emergency(), sceneId: "emergency", background: null },
  { file: "icu-background.svg", scene: icu(), sceneId: "icu", background: null },
  {
    file: "operating-room-background.svg",
    scene: operatingRoom(),
    sceneId: "operating-room",
    background: null,
  },
  { file: "patient-care-background.svg", scene: patientCare(), sceneId: "patient-care", background: null },
  { file: "laboratory-background.svg", scene: laboratory(), sceneId: "laboratory", background: null },
  { file: "gas-plant-background.svg", scene: gasPlant(), sceneId: "gas-plant", background: "url(#sky)" },
  { file: "gas-plant-foreground.svg", scene: gasPlantForeground(), background: null },
  { file: "utilities-background.svg", scene: utilities(), sceneId: "utilities", background: null },
];

const toPercent = ([x, y]: Pt) => ({
  x: Math.round((x / SCENE_ART.width) * 200) / 2,
  y: Math.round((y / SCENE_ART.height) * 200) / 2,
});

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const o of outputs) {
  fs.writeFileSync(path.join(OUT_DIR, o.file), o.scene.svg(o.background));
  console.log(`Wrote public/assets/scenes/placeholder/${o.file}`);
}

const sync = process.argv.includes("--sync-content");
let problems = 0;
for (const o of outputs.filter((o): o is Output & { sceneId: string } => o.sceneId !== undefined)) {
  const file = path.join(CONTENT_DIR, `${o.sceneId}.json`);
  const json = JSON.parse(fs.readFileSync(file, "utf8")) as {
    background: { assetStatus: string };
    hotspots: { id: string; x: number; y: number }[];
  };
  if (json.background.assetStatus === "approved") {
    console.log(`  ${o.sceneId.padEnd(15)} uses approved art: hotspots left as calibrated`);
    continue;
  }
  for (const h of json.hotspots) {
    const anchor = o.scene.anchors.get(h.id);
    if (!anchor) {
      console.warn(`  ! ${o.sceneId}: hotspot '${h.id}' has no anchor in the artwork`);
      problems++;
      continue;
    }
    const { x, y } = toPercent(anchor);
    console.log(
      `  ${o.sceneId.padEnd(15)} ${h.id.padEnd(30)} x ${String(x).padStart(5)}  y ${String(y).padStart(5)}`,
    );
    if (sync) Object.assign(h, { x, y });
  }
  for (const id of o.scene.anchors.keys()) {
    if (!json.hotspots.some((h) => h.id === id)) {
      console.warn(`  ! ${o.sceneId}: anchor '${id}' has no hotspot in content`);
      problems++;
    }
  }
  if (sync) fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}
if (sync) console.log("Synced hotspot coordinates into content/scenes (run Prettier to format).");
process.exitCode = problems > 0 ? 1 : 0;
