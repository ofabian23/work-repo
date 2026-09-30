import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionEventListSchema } from "@/domain/session/session-event";
import { renderKiosk, session, startSession } from "./kiosk-harness";

afterEach(() => vi.useRealTimers());

const openExplorer = () => {
  startSession();
  fireEvent.click(screen.getByTestId("path-explore"));
};
const sceneId = () => screen.getByTestId("explorer-screen").dataset.scene;
const eventTypes = () =>
  session().events.map((e: { type: string; targetId: string | null }) => [e.type, e.targetId]);

describe("hospital explorer in the kiosk", () => {
  it("opens on the campus, records the visit and focuses the scene title", () => {
    renderKiosk();
    openExplorer();
    expect(sceneId()).toBe("campus");
    expect(screen.getByRole("heading", { level: 1, name: "Campus hospitalario" })).toHaveFocus();
    expect(session().currentSceneId).toBe("campus");
    expect(eventTypes().slice(-1)).toEqual([["scene-visited", "campus"]]);
    expect(screen.queryByTestId("scene-breadcrumb")).toBeNull();
  });

  it("navigation hotspots change scene; breadcrumbs and “Volver” go back up", () => {
    renderKiosk();
    openExplorer();
    fireEvent.click(screen.getByTestId("hotspot-campus-to-icu"));
    expect(sceneId()).toBe("icu");
    const crumb = screen.getByTestId("scene-breadcrumb");
    expect(within(crumb).getByRole("button", { name: "Campus hospitalario" })).toBeInTheDocument();
    expect(within(crumb).getByText("Unidad de cuidado intensivo")).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByTestId("hotspot-icu-to-operating-room"));
    expect(sceneId()).toBe("operating-room");
    fireEvent.click(
      within(screen.getByTestId("scene-breadcrumb")).getByRole("button", { name: "Campus hospitalario" }),
    );
    expect(sceneId()).toBe("campus");

    fireEvent.click(screen.getByTestId("hotspot-campus-to-laboratory"));
    fireEvent.click(screen.getByTestId("explorer-back"));
    expect(sceneId()).toBe("campus");
    fireEvent.click(screen.getByTestId("explorer-back"));
    expect(screen.getByTestId("welcome-screen")).toBeInTheDocument();
  });

  it("information hotspots open a panel; solution hotspots let the visitor add interests", () => {
    renderKiosk();
    openExplorer();
    fireEvent.click(screen.getByTestId("hotspot-campus-expansion"));
    const sheet = screen.getByTestId("hotspot-sheet");
    expect(sheet).toHaveAttribute("open");
    expect(within(sheet).getByRole("heading", { level: 2 })).toHaveTextContent("Crecimiento");
    fireEvent.click(within(sheet).getByRole("button", { name: "Cerrar" }));

    fireEvent.click(screen.getByTestId("hotspot-campus-supply-network"));
    const panel = within(screen.getByTestId("hotspot-sheet")).getByTestId("solution-panel");
    fireEvent.click(within(panel).getByTestId("interest-medical-gas-supply-planning"));
    expect(session().signals.explicitInterestIds).toEqual(["medical-gas-supply-planning"]);
    expect(screen.getByTestId("hotspot-campus-supply-network")).toHaveAttribute("data-visited", "true");
  });

  it("a panel kept open counts as engagement", () => {
    vi.useFakeTimers();
    renderKiosk({ idle: { warningAfterMs: 600_000, countdownMs: 15_000 } });
    openExplorer();
    fireEvent.click(screen.getByTestId("hotspot-campus-expansion"));
    expect(session().signals.engagedHotspotIds).toEqual([]);
    act(() => vi.advanceTimersByTime(6_000));
    expect(session().signals.engagedHotspotIds).toEqual(["campus-expansion"]);
  });

  it("shows “Ver mis recomendaciones” once recommendations are ready and returns to the same scene", () => {
    renderKiosk();
    openExplorer();
    expect(screen.getByTestId("explorer-progress")).toHaveTextContent("Abra 3 puntos más");
    expect(screen.queryByTestId("view-my-recommendations")).toBeNull();
    fireEvent.click(screen.getByTestId("hotspot-campus-expansion"));
    fireEvent.click(screen.getByTestId("hotspot-campus-supply-network"));
    expect(screen.getByTestId("explorer-progress")).toHaveTextContent("Abra 1 punto más");
    // Moving between scenes is not a meaningful interaction on its own…
    fireEvent.click(screen.getByTestId("hotspot-campus-to-gas-plant"));
    expect(screen.queryByTestId("view-my-recommendations")).toBeNull();
    // …but looking at content in a second scene is (two distinct scenes).
    fireEvent.click(screen.getByTestId("hotspot-gas-plant-bulk-tank"));
    fireEvent.click(within(screen.getByTestId("hotspot-sheet")).getByRole("button", { name: "Cerrar" }));
    expect(screen.getByTestId("explorer-progress")).toHaveTextContent("Ya puede ver sus recomendaciones.");

    fireEvent.click(screen.getByTestId("view-my-recommendations"));
    expect(screen.getByTestId("recommendations-screen")).toBeInTheDocument();
    expect(screen.getAllByRole("article")[0]).toHaveTextContent(/abrió «/);
    fireEvent.click(screen.getByTestId("continue-exploring"));
    expect(sceneId()).toBe("gas-plant");
  });

  it("records only anonymous interaction events", () => {
    renderKiosk();
    openExplorer();
    fireEvent.click(screen.getByTestId("hotspot-campus-to-emergency"));
    fireEvent.click(screen.getByTestId("hotspot-emergency-surge-readiness"));
    const events = SessionEventListSchema.parse(session().events);
    expect(events.map((e) => [e.type, e.targetId])).toEqual([
      ["session-started", null],
      ["path-chosen", "explore"],
      ["scene-visited", "campus"],
      ["hotspot-opened", "campus-to-emergency"],
      ["scene-visited", "emergency"],
      ["hotspot-opened", "emergency-surge-readiness"],
    ]);
  });

  it("returns to the campus the next time, with nothing carried over after a reset", () => {
    const { onHardReset } = renderKiosk();
    openExplorer();
    fireEvent.click(screen.getByTestId("hotspot-campus-to-icu"));
    fireEvent.click(screen.getByTestId("reset-experience"));
    fireEvent.click(screen.getByRole("button", { name: "Sí, empezar de nuevo" }));
    expect(onHardReset).toHaveBeenCalledWith("explicit");
    openExplorer();
    expect(sceneId()).toBe("campus");
    expect(session().signals.openedHotspotIds).toEqual([]);
  });
});
