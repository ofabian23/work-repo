import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { visibleContent } from "@/domain/content/visibility";
import { approveForProduction } from "../helpers/fixtures";
import { clone, loadSeedBundle } from "../helpers/schema";
import { demoContent, renderKiosk } from "./kiosk-harness";

/**
 * Production content mode (ADR-060): the kiosk shows only validated, sales-approved content. Until the
 * sales review is done, visitors get a neutral "being prepared" message instead of empty or broken paths.
 */
const seed = loadSeedBundle();
const allAssumedNames = [
  ...seed.personas.map((p) => p.label.es),
  ...seed.challenges.map((c) => c.label.es),
  ...seed.solutions.map((s) => s.title.es),
  ...seed.scenes.map((s) => s.title.es),
];

function start() {
  fireEvent.click(screen.getByTestId("attract-start"));
}

describe("kiosk in production content mode", () => {
  it("with nothing validated: no entry paths, a neutral message, and no assumed content anywhere", () => {
    renderKiosk({ content: visibleContent(seed, "production") });
    start();
    expect(screen.getByTestId("welcome-unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("path-role")).toBeNull();
    expect(screen.queryByTestId("path-challenge")).toBeNull();
    expect(screen.queryByTestId("path-explore")).toBeNull();
    const text = document.body.textContent ?? "";
    for (const name of allAssumedNames) expect(text).not.toContain(name);
    // Neither the "pending local validation" badge nor the demo-mode footer notice.
    expect(text).not.toMatch(/pendiente de validación|modo demostración/i);
  });

  it("offers only the paths whose content has been validated and approved", () => {
    const b = clone(seed);
    approveForProduction(b.challenges.find((c) => c.id === "supply-continuity")!);
    renderKiosk({ content: visibleContent(b, "production") });
    start();
    expect(screen.getByTestId("path-challenge")).toBeInTheDocument();
    expect(screen.queryByTestId("path-role")).toBeNull();
    expect(screen.queryByTestId("path-explore")).toBeNull();
    fireEvent.click(screen.getByTestId("path-challenge"));
    const text = document.body.textContent ?? "";
    expect(text).toContain(b.challenges.find((c) => c.id === "supply-continuity")!.label.es);
    // Every other challenge is still assumed, so it is not offered.
    for (const c of seed.challenges.filter((x) => x.id !== "supply-continuity")) {
      expect(text).not.toContain(c.label.es);
    }
  });

  it("without approved consent text: recommendations but no summary request, and a neutral privacy notice", async () => {
    const b = clone(seed);
    for (const id of ["procurement-supply"]) approveForProduction(b.personas.find((p) => p.id === id)!);
    for (const c of b.challenges) approveForProduction(c);
    for (const s of b.solutions) approveForProduction(s);
    for (const r of b.recommendationRules) r.validationStatus = "validated";
    renderKiosk({ content: visibleContent(b, "production"), tailoringMs: 0 });
    start();
    fireEvent.click(screen.getByTestId("privacy-link"));
    expect(screen.getByTestId("privacy-notice")).toHaveTextContent("no solicita ningún dato personal");
    fireEvent.click(
      within(screen.getByTestId("privacy-sheet")).getAllByRole("button", { name: "Cerrar" })[0]!,
    );
    fireEvent.click(screen.getByTestId("path-role"));
    fireEvent.click(screen.getByTestId("persona-procurement-supply"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    fireEvent.click(screen.getByTestId("role-challenges-continue"));
    fireEvent.click(await screen.findByTestId("next-view-recommendations"));
    expect(screen.getByTestId("recommendations-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("send-summary")).toBeNull();
  });

  it("demo mode keeps all three paths", () => {
    renderKiosk({ content: demoContent });
    start();
    for (const path of ["role", "challenge", "explore"]) {
      expect(screen.getByTestId(`path-${path}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId("welcome-unavailable")).toBeNull();
    expect(screen.getByTestId("demo-mode-indicator")).toBeInTheDocument();
  });
});
