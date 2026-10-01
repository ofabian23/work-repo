# Approved scene art — originals and provenance (ADR-063)

This folder keeps the **original** scene illustrations exactly as delivered. They are never served to the
kiosk and never modified: `npm run art:scenes` only reads them and writes optimized WebP copies to
`public/assets/scenes/approved/`. Keep the originals here (not under `public/`, where every file is
downloadable and the 1 MB asset budget applies).

## Source and approval status

- **Source:** delivered by the project owner (Orlando Fabián) and committed to `main` in `a88bd1e`
  (2026-09-30, "Scene uploads…") and `440154a` (2026-10-01, "Added … Scene 7-Laboratory").
  Originally placed in `public/assets/scenes/prototype1/`; moved here unchanged on 2026-10-01 (SHA-256
  verified before and after the move).
- **Approval:** described by the project owner as "approved local assets" in the request of 2026-10-01.
  Recorded as `assetStatus: "approved"` in `content/scenes/*.json`. No separate written sign-off from Linde
  Marketing is on file; brand use in the artwork is still covered by RELEASE_READINESS gate 8 and
  PRIVACY_REVIEW A12 (**[Linde Marketing]**).
- **Items for marketing review (observed in the artwork, not changed):**
  - Scene 8 (gas plant) shows a legible **Linde** wordmark on the bulk tank; Scene 2 (campus) shows a
    stylized, illegible wordmark on its tank. Brand use needs marketing confirmation (A12).
  - Several images contain English text baked into the art (e.g. "Ambulance Bay", "Critical Care", "Bulk
    oxygen tank", "IBER (Internal Backup Emergency Reserve)"), while the kiosk is Spanish-first.
  - Some baked-in labels are misspelled or garbled: "Cryygenic Bulk oxygen" (Scene 2), "Backup eais safety
    systems" and "High-tech conduits it to master alarm systems" (Scene 8). Labels such as "Digital remote
    monitoring array" could read as product descriptions; they need the same no-unvalidated-claims review as
    the rest of the content (CONTENT_VALIDATION.md §9.6).

## Files

All are baseline JPEG, sRGB, 3 channels. Hash = first 16 hex digits of SHA-256.

| File                                                       | Pixels      | Size     | SHA-256 (prefix)   | Used for                                          |
| ---------------------------------------------------------- | ----------- | -------- | ------------------ | ------------------------------------------------- |
| `Scene 2- Hospital Campus Cutaway.jpeg`                    | 768 × 1376  | 731 KB   | `39adb1f6cdb60e41` | `campus` (copies at 640 and 768 px: no upscaling) |
| `Scene 3- Emergency Department.jpeg`                       | 1536 × 2752 | 2,460 KB | `4d4bde3f796f23a5` | `emergency`                                       |
| `Scene 4- Intensive Care Unit and NICU.jpeg`               | 1536 × 2752 | 2,521 KB | `f3b7eeae7d7386e1` | `icu`                                             |
| `Scene 5- Operating Room.jpeg`                             | 1536 × 2752 | 2,050 KB | `7d4d3188bbfe12bc` | `operating-room`                                  |
| `Scene 6- Patient Care Areas.jpeg`                         | 1536 × 2752 | 2,417 KB | `94c65a08ce8ff088` | `patient-care`                                    |
| `Scene 7- Laboratory.jpeg`                                 | 1536 × 2752 | 2,486 KB | `e35f12ffad58f8a2` | `laboratory`                                      |
| `Scene 8- Medical Gas Plant and Exterior Suministro..jpeg` | 1536 × 2752 | 2,046 KB | `9855a89ca3df14ea` | `gas-plant`                                       |
| `Scene 9- Utility and Infrastructure Areas.jpeg`           | 1536 × 2752 | 2,378 KB | `371ad1e325050e40` | `utilities`                                       |
| `Scene 1- Healthcare Ecosystem Overview.jpeg`              | 768 × 1376  | 908 KB   | `6fe583fca6081bff` | **Not used** — no matching scene yet              |
| `Homecare Ecosystem and Logistics.jpeg`                    | 1536 × 2752 | 3,231 KB | `7e06695681f985d5` | **Not used** — no matching scene yet              |
| `Scene 11- Ambulance Interior and Critical Transport.jpeg` | 1536 × 2752 | 2,482 KB | `2706d7b5c4fb22c9` | **Not used** — no matching scene yet              |

The three unused images are not copied to `public/` and appear nowhere in the kiosk. Using them needs new
scenes (hotspots, texts, navigation), which is new content scope for the project owner to decide.

## Replacing or adding art

1. Put the original here. Scene art must have the art box proportions (1536 × 2752, ≈ 9:16 portrait,
   `src/domain/content/scene-art.ts`); `npm run content:check` refuses other proportions.
2. Map it to a scene in `SCENES` in `scripts/scene-art.ts`, run `npm run art:scenes`, and paste the printed
   `srcSet` into the scene's `background` (with `assetStatus` and Spanish/English `alt` text).
3. Re-check hotspot positions with `/dev/scenes` (`ENABLE_SCENE_CALIBRATION=true`) and move only the ones
   that no longer sit on their feature.
4. Record the source and approval above and in CONTENT_VALIDATION.md §9.6.
