import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SceneLayerSchema } from "@/domain/content/scene";
import { PERSONA_ART_RATIO } from "@/domain/content/persona-art";
import { SCENE_ART, SCENE_ART_RATIO } from "@/domain/content/scene-art";
import { imageSizeFromBuffer, readImageSize } from "@/server/content/image-size";
import { loadContentFromDirectory } from "@/server/content/load-content";
import { CONTENT_DIR, PROJECT_ROOT, loadSeedBundle } from "../../helpers/schema";

const publicPath = (src: string) => path.join(PROJECT_ROOT, "public", ...src.split("/").filter(Boolean));
const ORIGINALS = path.join(PROJECT_ROOT, "art-source", "scenes", "prototype1");

describe("approved scene art (ADR-063)", () => {
  const scenes = loadSeedBundle().scenes;

  it("every scene uses approved art with responsive WebP candidates that match the art box", () => {
    expect(scenes).toHaveLength(8);
    for (const scene of scenes) {
      const bg = scene.background;
      expect(bg.assetStatus, scene.id).toBe("approved");
      expect(bg.src, scene.id).toMatch(/^\/assets\/scenes\/approved\/[a-z-]+-\d+\.webp$/);
      expect(scene.foregroundLayers, scene.id).toEqual([]);
      for (const candidate of bg.srcSet!) {
        const size = readImageSize(publicPath(candidate.src));
        expect(size, candidate.src).not.toBeNull();
        expect(size!.width, candidate.src).toBe(candidate.width);
        expect(Math.abs(size!.width / size!.height / SCENE_ART_RATIO - 1), candidate.src).toBeLessThan(0.01);
        expect(candidate.width, candidate.src).toBeLessThanOrEqual(SCENE_ART.width);
      }
    }
  });

  it("never upscales: no candidate is wider than its original", () => {
    const originals: Record<string, string> = {
      campus: "Scene 2- Hospital Campus Cutaway.jpeg",
      laboratory: "Scene 7- Laboratory.jpeg",
    };
    for (const [id, file] of Object.entries(originals)) {
      const original = readImageSize(path.join(ORIGINALS, file))!;
      const scene = scenes.find((s) => s.id === id)!;
      expect(Math.max(...scene.background.srcSet!.map((c) => c.width))).toBeLessThanOrEqual(original.width);
    }
  });

  it("keeps the originals out of public/ (not served) and only optimized copies under 300 KB in it", () => {
    expect(existsSync(path.join(PROJECT_ROOT, "public", "assets", "scenes", "prototype1"))).toBe(false);
    expect(existsSync(path.join(ORIGINALS, "Scene 2- Hospital Campus Cutaway.jpeg"))).toBe(true);
    for (const scene of scenes) {
      for (const candidate of scene.background.srcSet!) {
        expect(readFileSync(publicPath(candidate.src)).length, candidate.src).toBeLessThan(300 * 1024);
      }
    }
  });

  it("keeps hotspots and their accessible labels on every scene", () => {
    for (const scene of scenes) {
      for (const h of scene.hotspots) {
        expect(h.x).toBeGreaterThanOrEqual(0);
        expect(h.x).toBeLessThanOrEqual(100);
        expect(h.accessibleLabel.es.length, h.id).toBeGreaterThan(0);
        expect(h.accessibleLabel.en.length, h.id).toBeGreaterThan(0);
      }
    }
  });
});

describe("scene layer srcSet schema", () => {
  const layer = {
    src: "/assets/scenes/approved/icu-1536.webp",
    alt: { es: "Ilustración.", en: "Illustration." },
    depth: 0,
    assetStatus: "approved",
  };

  it("accepts ascending candidates whose largest is the fallback src", () => {
    const srcSet = [
      { src: "/assets/scenes/approved/icu-640.webp", width: 640 },
      { src: "/assets/scenes/approved/icu-1536.webp", width: 1536 },
    ];
    expect(SceneLayerSchema.safeParse({ ...layer, srcSet }).success).toBe(true);
    expect(SceneLayerSchema.safeParse(layer).success).toBe(true);
  });

  it("rejects unordered candidates, a fallback that is not the largest, and unknown fields", () => {
    const unordered = SceneLayerSchema.safeParse({
      ...layer,
      srcSet: [
        { src: "/assets/scenes/approved/icu-1536.webp", width: 1536 },
        { src: "/assets/scenes/approved/icu-640.webp", width: 640 },
      ],
    });
    expect(unordered.success).toBe(false);
    const wrongFallback = SceneLayerSchema.safeParse({
      ...layer,
      srcSet: [{ src: "/assets/scenes/approved/icu-640.webp", width: 640 }],
    });
    expect(wrongFallback.success).toBe(false);
    expect(
      SceneLayerSchema.safeParse({
        ...layer,
        srcSet: [{ src: layer.src, width: 1536, density: 2 }],
      }).success,
    ).toBe(false);
  });
});

describe("image size reader", () => {
  it("reads WebP (lossy), SVG, JPEG and PNG headers", () => {
    expect(readImageSize(publicPath("/assets/scenes/approved/icu-640.webp"))).toEqual({
      width: 640,
      height: 1147,
    });
    expect(readImageSize(publicPath("/assets/scenes/placeholder/icu-background.svg"))).toEqual({
      width: 1200,
      height: 1500,
    });
    expect(readImageSize(path.join(ORIGINALS, "Scene 4- Intensive Care Unit and NICU.jpeg"))).toEqual({
      width: 1536,
      height: 2752,
    });
    const png = Buffer.alloc(24);
    png.writeUInt32BE(0x89504e47, 0);
    png.write("IHDR", 12, "ascii");
    png.writeUInt32BE(400, 16);
    png.writeUInt32BE(600, 20);
    expect(imageSizeFromBuffer(png)).toEqual({ width: 400, height: 600 });
  });

  it("reads lossless and extended WebP headers, and returns null for anything else", () => {
    const riff = (chunk: string, body: Buffer) =>
      Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP" + chunk, "ascii"), Buffer.alloc(4), body]);
    const lossless = Buffer.alloc(20);
    lossless[0] = 0x2f;
    lossless.writeUInt32LE((99 & 0x3fff) | ((199 & 0x3fff) << 14), 1);
    expect(imageSizeFromBuffer(riff("VP8L", lossless))).toEqual({ width: 100, height: 200 });
    const extended = Buffer.alloc(20);
    extended.writeUIntLE(1535, 4, 3);
    extended.writeUIntLE(2751, 7, 3);
    expect(imageSizeFromBuffer(riff("VP8X", extended))).toEqual({ width: 1536, height: 2752 });
    expect(imageSizeFromBuffer(Buffer.from("not an image"))).toBeNull();
    expect(readImageSize(path.join(PROJECT_ROOT, "does-not-exist.webp"))).toBeNull();
  });
});

describe("content check refuses art that does not match the art box", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  const setup = () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "linde-art-"));
    const contentDir = path.join(dir, "content");
    const publicDir = path.join(dir, "public");
    cpSync(CONTENT_DIR, contentDir, { recursive: true });
    cpSync(path.join(PROJECT_ROOT, "public", "assets"), path.join(publicDir, "assets"), { recursive: true });
    return { contentDir, publicDir };
  };

  const pointIcuAt = (contentDir: string, background: object) => {
    const file = path.join(contentDir, "scenes", "icu.json");
    const json = JSON.parse(readFileSync(file, "utf8"));
    json.background = { ...json.background, ...background };
    writeFileSync(file, JSON.stringify(json));
  };

  it("errors for approved art with other proportions (e.g. the old 4:5 placeholder)", () => {
    const { contentDir, publicDir } = setup();
    pointIcuAt(contentDir, { src: "/assets/scenes/placeholder/icu-background.svg", srcSet: undefined });
    const result = loadContentFromDirectory(contentDir, { publicDir });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        file: "content/scenes/icu.json",
        path: "background.src",
        message: expect.stringContaining(`${SCENE_ART.width} × ${SCENE_ART.height} scene art box`),
      }),
    );
  });

  it("only warns when the mismatched art is marked as a placeholder", () => {
    const { contentDir, publicDir } = setup();
    pointIcuAt(contentDir, {
      src: "/assets/scenes/placeholder/icu-background.svg",
      srcSet: undefined,
      assetStatus: "placeholder",
    });
    const issues = loadContentFromDirectory(contentDir, { publicDir }).issues;
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({ severity: "warning", path: "background.src" }));
  });

  it("errors when a candidate's declared width is wrong or its file is missing", () => {
    const { contentDir, publicDir } = setup();
    pointIcuAt(contentDir, {
      src: "/assets/scenes/approved/icu-1536.webp",
      srcSet: [
        { src: "/assets/scenes/approved/icu-640.webp", width: 700 },
        { src: "/assets/scenes/approved/icu-1536.webp", width: 1536 },
      ],
    });
    rmSync(path.join(publicDir, "assets", "scenes", "approved", "icu-1536.webp"));
    mkdirSync(path.join(publicDir, "assets", "scenes", "approved"), { recursive: true });
    const issues = loadContentFromDirectory(contentDir, { publicDir }).issues;
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", path: "background.srcSet[0].width" }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        path: "background.srcSet[1]",
        message: expect.stringContaining("Approved image not found"),
      }),
    );
  });
});

describe("persona illustrations (ADR-064)", () => {
  const personas = loadSeedBundle().personas;
  const MAPPING: Record<string, string> = {
    executive: "Hospital Executive.png",
    "operations-facilities": "Facilities Director.png",
    "procurement-supply": "Procurement Leader.png",
    "clinical-respiratory": "Respiratory Therapist.png",
    "quality-compliance": "Quality Manager.png",
    finance: "Finance Leader.png",
    "technology-biomed": "Biomedical Engineer.png",
    "ambulatory-homecare": "Homecare Provider.png",
  };

  it("maps 8 personas to approved 2:3 WebP copies that exist with their declared widths", () => {
    const illustrated = personas.filter((p) => p.illustration);
    expect(illustrated.map((p) => p.id).sort()).toEqual(Object.keys(MAPPING).sort());
    for (const p of illustrated) {
      expect(p.illustration!.assetStatus, p.id).toBe("approved");
      for (const c of p.illustration!.srcSet) {
        expect(c.src, p.id).toMatch(new RegExp(`^/assets/personas/${p.id}-\\d+\\.webp$`));
        const size = readImageSize(publicPath(c.src))!;
        expect(size.width, c.src).toBe(c.width);
        expect(size.width / size.height, c.src).toBeCloseTo(PERSONA_ART_RATIO, 2);
        expect(readFileSync(publicPath(c.src)).length, c.src).toBeLessThan(20 * 1024);
      }
    }
  });

  it("keeps every original unchanged and unserved, and publishes nothing for the unused ones", () => {
    const originals = path.join(PROJECT_ROOT, "art-source", "personas");
    expect(existsSync(path.join(PROJECT_ROOT, "public", "assets", "brand", "icons", "personas"))).toBe(false);
    for (const file of [...Object.values(MAPPING), "Clinical Director.png", "Technology Leader.png"]) {
      expect(readImageSize(path.join(originals, file)), file).toEqual({ width: 400, height: 600 });
    }
    expect(
      existsSync(path.join(PROJECT_ROOT, "public", "assets", "personas", "clinical-director-160.webp")),
    ).toBe(false);
  });

  it("rejects illustrations with other proportions or wrong widths in content:check", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "linde-persona-"));
    try {
      const contentDir = path.join(dir, "content");
      const publicDir = path.join(dir, "public");
      cpSync(CONTENT_DIR, contentDir, { recursive: true });
      cpSync(path.join(PROJECT_ROOT, "public", "assets"), path.join(publicDir, "assets"), {
        recursive: true,
      });
      const file = path.join(contentDir, "personas.json");
      const json = JSON.parse(readFileSync(file, "utf8"));
      // A scene image (≈ 9:16) is not a 2:3 portrait; a wrong declared width is an error too.
      json[0].illustration = {
        src: "/assets/scenes/approved/icu-640.webp",
        srcSet: [
          { src: "/assets/personas/executive-160.webp", width: 170 },
          { src: "/assets/scenes/approved/icu-640.webp", width: 640 },
        ],
        assetStatus: "approved",
      };
      writeFileSync(file, JSON.stringify(json));
      const issues = loadContentFromDirectory(contentDir, { publicDir }).issues;
      expect(issues).toContainEqual(
        expect.objectContaining({
          severity: "error",
          file: "content/personas.json",
          path: "[0].illustration.srcSet[1]",
          message: expect.stringContaining("executive: "),
        }),
      );
      expect(issues).toContainEqual(
        expect.objectContaining({ severity: "error", path: "[0].illustration.srcSet[0].width" }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
