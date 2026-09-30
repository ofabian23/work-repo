import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderKiosk, startSession } from "./kiosk-harness";

/**
 * Throughput design (ADR-055): a short route to recommendations, the explorer optional after readiness,
 * the recommendations action always visible once ready, and one dominant next action per screen.
 */
const tailoring = () => act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
const screenName = () => screen.getByTestId("kiosk-experience").dataset.screen;
const api = () => ({
  submit: vi.fn(async () => ({ kind: "stored" as const, statusToken: "T".repeat(43) })),
  status: vi.fn(async () => "sent" as const),
});

/** Visible dominant actions on the current screen (closed dialogs and the header excluded). */
function dominantActions() {
  const root = screen.getByTestId("kiosk-experience");
  return [...root.querySelectorAll<HTMLElement>('[data-variant="primary"]')].filter(
    (el) => !el.closest("dialog:not([open])"),
  );
}

function expectOneDominant(label: string) {
  const found = dominantActions();
  expect(
    found.map((el) => el.textContent),
    `${label}: exactly one dominant action`,
  ).toHaveLength(1);
}

describe("short routes to recommendations", () => {
  it("role route: 6 taps from the attract screen", async () => {
    renderKiosk({ tailoringMs: 10 });
    let taps = 0;
    const tap = (id: string) => {
      taps++;
      fireEvent.click(screen.getByTestId(id));
    };
    tap("attract-start");
    tap("path-role");
    tap("persona-procurement-supply");
    tap("persona-continue");
    tap("role-challenges-continue"); // challenges are optional
    await tailoring();
    tap("next-view-recommendations");
    expect(screenName()).toBe("recommendations");
    expect(taps).toBeLessThanOrEqual(6);
  });

  it("challenge route: 5 taps (role optional)", async () => {
    renderKiosk({ tailoringMs: 10 });
    for (const id of [
      "attract-start",
      "path-challenge",
      "challenge-supply-continuity",
      "challenges-continue",
    ]) {
      fireEvent.click(screen.getByTestId(id));
    }
    fireEvent.click(screen.getByTestId("persona-continue")); // "Continuar sin elegir"
    await tailoring();
    expect(screenName()).toBe("recommendations");
  });
});

describe("explorer after readiness", () => {
  it("is optional, and the recommendations action stays visible while exploring", async () => {
    renderKiosk({ tailoringMs: 10 });
    startSession();
    fireEvent.click(screen.getByTestId("path-role"));
    fireEvent.click(screen.getByTestId("persona-procurement-supply"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    fireEvent.click(screen.getByTestId("role-challenges-continue"));
    await tailoring();
    // Explorer is one option among three, not a required step.
    expect(screen.getByTestId("next-view-recommendations")).toHaveAttribute("data-variant", "primary");
    fireEvent.click(screen.getByTestId("next-explore-areas"));
    expect(screen.getByTestId("view-my-recommendations")).toBeVisible();
    fireEvent.click(screen.getByTestId("hotspot-campus-to-gas-plant"));
    expect(screen.getByTestId("view-my-recommendations")).toBeVisible();
    fireEvent.click(screen.getByTestId("view-my-recommendations"));
    expect(screenName()).toBe("recommendations");
  });
});

describe("one dominant next action per screen, no dead ends", () => {
  it("every journey screen offers exactly one dominant action", async () => {
    renderKiosk({ tailoringMs: 10, leadApi: api() });
    startSession();
    fireEvent.click(screen.getByTestId("path-role"));
    expectOneDominant("role");
    fireEvent.click(screen.getByTestId("persona-procurement-supply"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    expectOneDominant("role challenges");
    fireEvent.click(screen.getByTestId("role-challenges-continue"));
    await tailoring();
    expectOneDominant("next steps");
    fireEvent.click(screen.getByTestId("next-refine-challenges"));
    expectOneDominant("refine");
    fireEvent.click(screen.getByTestId("refine-continue"));
    expectOneDominant("recommendations");
    fireEvent.click(screen.getByTestId("continue-exploring"));
    expectOneDominant("explorer (ready)");
    fireEvent.click(screen.getByTestId("view-my-recommendations"));
    fireEvent.click(screen.getByTestId("send-summary"));
    expectOneDominant("summary request");
    fireEvent.click(screen.getByTestId("summary-continue"));
    expectOneDominant("contact details");
    const type = (id: string, value: string) =>
      fireEvent.change(screen.getByTestId(id), { target: { value } });
    type("lead-firstName", "Ana");
    type("lead-lastName", "López");
    type("lead-organization", "Clínica Norte");
    type("lead-email", "ana@clinica.example");
    fireEvent.click(screen.getByTestId("lead-continue"));
    expectOneDominant("preferences");
    fireEvent.click(screen.getByTestId("consent-report"));
    fireEvent.click(screen.getByTestId("lead-continue"));
    expectOneDominant("review");
    fireEvent.click(screen.getByTestId("lead-submit"));
    await act(async () => undefined);
    expectOneDominant("completion");
  });

  it("the challenge path screens offer exactly one dominant action too", () => {
    renderKiosk({ tailoringMs: 10 });
    startSession();
    fireEvent.click(screen.getByTestId("path-challenge"));
    expectOneDominant("challenges");
    fireEvent.click(screen.getByTestId("challenge-supply-continuity"));
    fireEvent.click(screen.getByTestId("challenges-continue"));
    expectOneDominant("optional role");
  });
});
