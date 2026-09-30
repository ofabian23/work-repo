import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmitOutcome } from "@/features/kiosk/lead/lead-api";
import { renderKiosk, session, startSession } from "./kiosk-harness";

/**
 * Convention session management (ADR-055) with fake timers: session states, inactivity warning,
 * "Continuar mi sesión", automatic reset, the completion countdown and submissions in progress.
 */
const IDLE = {
  warningAfterMs: 10_000,
  countdownMs: 5_000,
  leadFormWarningAfterMs: 30_000,
  leadFormCountdownMs: 5_000,
};
const TOKEN = "T".repeat(43);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const phase = () => screen.getByTestId("kiosk-experience").dataset.sessionPhase;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const flush = () => act(async () => undefined);
const warning = () => screen.queryByTestId("inactivity-warning");
const warningOpen = () => (warning() as HTMLDialogElement | null)?.open === true;

function api(submit: () => Promise<SubmitOutcome> = async () => ({ kind: "stored", statusToken: TOKEN })) {
  return { submit: vi.fn(submit), status: vi.fn(async () => "sent" as const) };
}

function render(overrides: Parameters<typeof renderKiosk>[0] = {}) {
  return renderKiosk({
    tailoringMs: 10,
    idle: IDLE,
    confirmationResetMs: 15_000,
    leadApi: api(),
    ...overrides,
  });
}

/** attract → role → recommendations (the short route). */
function toRecommendations() {
  startSession();
  fireEvent.click(screen.getByTestId("path-role"));
  fireEvent.click(screen.getByTestId("persona-procurement-supply"));
  fireEvent.click(screen.getByTestId("persona-continue"));
  fireEvent.click(screen.getByTestId("role-challenges-continue"));
  advance(20);
  fireEvent.click(screen.getByTestId("next-view-recommendations"));
}

function toReview() {
  fireEvent.click(screen.getByTestId("send-summary"));
  fireEvent.click(screen.getByTestId("summary-continue"));
  const type = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });
  type("lead-firstName", "María José");
  type("lead-lastName", "Rivera");
  type("lead-organization", "Hospital San Juan");
  type("lead-email", "maria.rivera@hospital.example");
  fireEvent.click(screen.getByTestId("lead-continue"));
  fireEvent.click(screen.getByTestId("consent-report"));
  fireEvent.click(screen.getByTestId("lead-continue"));
}

const PERSONAL = ["María", "Rivera", "Hospital San Juan", "maria.rivera", "ma•••@hospital.example"];

describe("session states", () => {
  it("moves through attracting → active → recommendation-ready → entering-contact → submitting → complete → attracting", async () => {
    let resolve!: (o: SubmitOutcome) => void;
    const { onHardReset } = render({ leadApi: api(() => new Promise((r) => (resolve = r))) });
    expect(phase()).toBe("attracting");
    startSession();
    expect(phase()).toBe("active");
    fireEvent.click(screen.getByTestId("path-role"));
    fireEvent.click(screen.getByTestId("persona-procurement-supply"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    fireEvent.click(screen.getByTestId("role-challenges-continue"));
    advance(20);
    fireEvent.click(screen.getByTestId("next-view-recommendations"));
    expect(phase()).toBe("recommendation-ready");
    toReview();
    expect(phase()).toBe("entering-contact");
    fireEvent.click(screen.getByTestId("lead-submit"));
    expect(phase()).toBe("submitting");
    await act(async () => resolve({ kind: "stored", statusToken: TOKEN }));
    await flush();
    expect(phase()).toBe("complete");
    fireEvent.click(screen.getByTestId("lead-finish"));
    expect(onHardReset).toHaveBeenCalledWith("completed");
    expect(phase()).toBe("attracting");
  });
});

describe("inactivity", () => {
  it("warns after the configured interval and counts down", () => {
    render();
    toRecommendations();
    advance(IDLE.warningAfterMs - 100);
    expect(warningOpen()).toBe(false);
    advance(100);
    expect(warningOpen()).toBe(true);
    expect(warning()).toHaveTextContent("la experiencia se reiniciará en 5 segundos");
    advance(2_000);
    expect(warning()).toHaveTextContent("3 segundos");
  });

  it("“Continuar mi sesión” keeps everything and restarts the full interval", () => {
    const { onHardReset } = render();
    toRecommendations();
    const before = session();
    advance(IDLE.warningAfterMs + 3_000);
    fireEvent.click(within(warning()!).getByRole("button", { name: "Continuar mi sesión" }));
    expect(warningOpen()).toBe(false);
    expect(screen.getByTestId("recommendations-screen")).toBeInTheDocument();
    expect(session().id).toBe(before.id);
    advance(IDLE.warningAfterMs - 100);
    expect(warningOpen()).toBe(false);
    advance(100 + IDLE.countdownMs);
    expect(onHardReset).toHaveBeenCalledWith("timeout");
  });

  it("resets automatically: attract screen, fresh session id, no previous recommendations", () => {
    const { onHardReset } = render();
    toRecommendations();
    const previousId = session().id;
    advance(IDLE.warningAfterMs + IDLE.countdownMs);
    expect(onHardReset).toHaveBeenCalledWith("timeout");
    expect(phase()).toBe("attracting");
    expect(screen.getByTestId("attract-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("recommendations-screen")).toBeNull();

    startSession();
    expect(session().id).not.toBe(previousId);
    expect(session().recommendations).toBeNull();
    expect(session().signals.personaId).toBeNull();
    expect(screen.getByTestId("kiosk-experience").dataset.screen).toBe("welcome");
  });

  it("gives the contact form the longer allowance and clears typed data on timeout", () => {
    const { onHardReset } = render();
    toRecommendations();
    toReview();
    advance(IDLE.warningAfterMs + IDLE.countdownMs);
    expect(warningOpen()).toBe(false);
    expect(onHardReset).not.toHaveBeenCalled();
    advance(IDLE.leadFormWarningAfterMs - IDLE.warningAfterMs - IDLE.countdownMs);
    expect(warningOpen()).toBe(true);
    advance(IDLE.leadFormCountdownMs);
    expect(onHardReset).toHaveBeenCalledWith("timeout");
    PERSONAL.forEach((v) => expect(document.body.textContent).not.toContain(v));
  });
});

describe("submission in progress", () => {
  it("never shows the warning or resets while the submission is completing", async () => {
    let resolve!: (o: SubmitOutcome) => void;
    const { onHardReset } = render({ leadApi: api(() => new Promise((r) => (resolve = r))) });
    toRecommendations();
    toReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    expect(phase()).toBe("submitting");
    expect(screen.getByTestId("reset-experience")).toBeDisabled();

    advance(10 * (IDLE.leadFormWarningAfterMs + IDLE.leadFormCountdownMs));
    expect(warningOpen()).toBe(false);
    expect(onHardReset).not.toHaveBeenCalled();
    expect(screen.getByTestId("lead-sending")).toBeInTheDocument();

    await act(async () => resolve({ kind: "stored", statusToken: TOKEN }));
    await flush();
    expect(phase()).toBe("complete");
    expect(screen.getByTestId("lead-result")).toBeInTheDocument();
  });

  it("defers a reset requested during the submission until it settles", async () => {
    let resolve!: (o: SubmitOutcome) => void;
    const { onHardReset } = render({ leadApi: api(() => new Promise((r) => (resolve = r))) });
    toRecommendations();
    toReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    fireEvent.click(screen.getByTestId("probe-reset"));
    expect(onHardReset).not.toHaveBeenCalled();
    expect(phase()).toBe("submitting");

    await act(async () => resolve({ kind: "failed" }));
    await flush();
    expect(onHardReset).toHaveBeenCalledWith("timeout");
    expect(phase()).toBe("attracting");
    PERSONAL.forEach((v) => expect(document.body.textContent).not.toContain(v));
  });

  it("returns to the form (idle timer running again) when the submission fails", async () => {
    const { onHardReset } = render({ leadApi: api(async () => ({ kind: "failed" })) });
    toRecommendations();
    toReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(phase()).toBe("entering-contact");
    advance(IDLE.leadFormWarningAfterMs + IDLE.leadFormCountdownMs);
    expect(onHardReset).toHaveBeenCalledWith("timeout");
  });
});

describe("completion screen", () => {
  async function complete(overrides: Parameters<typeof renderKiosk>[0] = {}) {
    const utils = render(overrides);
    toRecommendations();
    toReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(phase()).toBe("complete");
    return utils;
  }

  it("shows delivery status, masked email, the optional consultation step and a countdown", async () => {
    await complete();
    const result = screen.getByTestId("lead-result");
    expect(screen.getByTestId("delivery-status")).toHaveTextContent("Lo enviamos a ma•••@hospital.example");
    const consultation = within(result).getByTestId("consultation-next-step");
    expect(consultation).toHaveTextContent("Siguiente paso opcional");
    expect(consultation).toHaveTextContent("Converse con un especialista");
    expect(within(consultation).getByTestId("consultation-contact")).toHaveTextContent(
      "Equipo comercial (ejemplo) · ventas@example.com",
    );
    expect(screen.getByTestId("completion-countdown")).toHaveTextContent("Volveremos al inicio en 15 s.");
    advance(3_000);
    expect(screen.getByTestId("completion-countdown")).toHaveTextContent("Volveremos al inicio en 12 s.");
    expect(screen.getByTestId("lead-finish")).toHaveTextContent("Finalizar ahora");
  });

  it("returns to the attract screen automatically, with no contact data left", async () => {
    const { onHardReset } = await complete();
    const previousId = session().id;
    advance(14_000);
    expect(onHardReset).not.toHaveBeenCalled();
    // The inactivity warning never interrupts the completion screen.
    expect(warningOpen()).toBe(false);
    advance(1_000);
    await flush();
    expect(onHardReset).toHaveBeenCalledWith("completed");
    expect(onHardReset).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("attract-screen")).toBeInTheDocument();
    PERSONAL.forEach((v) => expect(document.body.textContent).not.toContain(v));
    startSession();
    expect(session().id).not.toBe(previousId);
  });

  it("“Finalizar ahora” ends the visit at once, and only once", async () => {
    const { onHardReset } = await complete();
    fireEvent.click(screen.getByTestId("lead-finish"));
    advance(20_000);
    await flush();
    expect(onHardReset).toHaveBeenCalledTimes(1);
    expect(onHardReset).toHaveBeenCalledWith("completed");
  });
});
