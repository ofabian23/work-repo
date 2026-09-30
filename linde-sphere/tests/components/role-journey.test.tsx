import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionEventListSchema } from "@/domain/session/session-event";
import { renderKiosk, session, startSession } from "./kiosk-harness";

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.lang = "es";
});

/** Every property name in a JSON value (content text may mention organizations; field names may not). */
function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [k, ...allKeys(v)]);
  }
  return [];
}

const screenId = () => screen.getByTestId("probe").dataset.screen;

/** A short transition keeps these tests fast; its timing is covered by a dedicated fake-timer test. */
const renderJourney = () => renderKiosk({ tailoringMs: 20 });

/** Welcome → "Trabajo en…" → persona → suggested challenges → tailoring → next steps. */
async function walkRoleJourney(personaId: string, challengeId?: string) {
  const user = userEvent.setup();
  startSession();
  await user.click(screen.getByTestId("path-role"));
  await user.click(screen.getByTestId(`persona-${personaId}`));
  await user.click(screen.getByTestId("persona-continue"));
  if (challengeId) await user.click(screen.getByTestId(`challenge-${challengeId}`));
  await user.click(screen.getByTestId("role-challenges-continue"));
  expect(screen.getByTestId("tailoring-screen")).toHaveTextContent(
    "Estamos adaptando la experiencia a sus prioridades.",
  );
  expect(await screen.findByTestId("next-steps-screen")).toBeInTheDocument();
  return user;
}

describe("persona selection", () => {
  it("shows every professional area as a plain-language card, plus the several-areas option", async () => {
    renderKiosk();
    startSession();
    await userEvent.click(screen.getByTestId("path-role"));
    const list = screen.getByRole("list", { name: "Áreas profesionales" });
    expect(within(list).getAllByRole("button")).toHaveLength(10);
    expect(within(list).getByTestId("persona-operations-facilities")).toHaveTextContent(
      "Operaciones e instalacionesInfraestructura, confiabilidad y mantenimiento.",
    );
    expect(screen.getByTestId("persona-multiple-areas")).toHaveTextContent("Mi función abarca varias áreas");
    expect(screen.getByTestId("progress")).toHaveTextContent("Paso 1 de 2");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("allows one primary persona: selecting another replaces it, and Continue waits for a choice", async () => {
    renderKiosk();
    startSession();
    await userEvent.click(screen.getByTestId("path-role"));
    expect(screen.getByTestId("persona-continue")).toBeDisabled();
    await userEvent.click(screen.getByTestId("persona-finance"));
    await userEvent.click(screen.getByTestId("persona-executive"));
    expect(screen.getByTestId("persona-finance")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("persona-executive")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("persona-continue")).toBeEnabled();
    expect(session().signals.personaId).toBe("executive");
  });

  it("calculates preliminary recommendations as soon as a persona is selected", async () => {
    renderJourney();
    const user = await walkRoleJourney("procurement-supply");
    expect(screen.getByTestId("next-view-recommendations")).toHaveTextContent("3 recomendaciones");
    expect(session().recommendations.items.map((i: { solutionId: string }) => i.solutionId)).toEqual([
      "medical-gas-supply-planning",
      "cylinder-inventory-management",
      "bulk-centralized-supply",
    ]);
    await user.click(screen.getByTestId("next-view-recommendations"));
    expect(screen.getByTestId("recommendations-screen")).toBeInTheDocument();
  });
});

describe("role-relevant challenges", () => {
  it("shows at most four suggestions for the role plus “Something else”", async () => {
    renderKiosk();
    startSession();
    await userEvent.click(screen.getByTestId("path-role"));
    await userEvent.click(screen.getByTestId("persona-clinical-respiratory"));
    await userEvent.click(screen.getByTestId("persona-continue"));
    const list = screen.getByRole("list", { name: "Retos sugeridos" });
    const ids = within(list)
      .getAllByRole("button")
      .map((b) => b.dataset.testid);
    expect(ids).toEqual([
      "challenge-patient-staff-safety",
      "challenge-clinical-workflow",
      "challenge-cylinder-inventory",
      "challenge-care-outside-hospital",
      "challenge-something-else",
    ]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("¿Cuáles son sus prioridades?");
    expect(screen.getByTestId("role-challenges-screen")).toHaveTextContent(
      "«Clínica y terapia respiratoria»".slice(1, -1),
    );
  });

  it("“Something else” is a valid choice that needs no text and is recorded as an event", async () => {
    renderKiosk();
    startSession();
    await userEvent.click(screen.getByTestId("path-role"));
    await userEvent.click(screen.getByTestId("persona-finance"));
    await userEvent.click(screen.getByTestId("persona-continue"));
    await userEvent.click(screen.getByTestId("challenge-something-else"));
    expect(screen.getByTestId("challenge-something-else")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(session().otherChallengeSelected).toBe(true);
    expect(session().signals.challengeIds).toEqual([]);
    expect(session().events.at(-1)).toEqual({ seq: 3, type: "other-challenge-selected", targetId: null });
  });

  it("the several-areas option shows common challenges and still reaches recommendations", async () => {
    renderJourney();
    const user = await walkRoleJourney("multiple-areas", "supply-continuity");
    expect(screen.getByTestId("next-steps-summary")).toHaveTextContent(
      "Área: Mi función abarca varias áreas",
    );
    await user.click(screen.getByTestId("next-view-recommendations"));
    const cards = screen.getAllByRole("article");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]).toHaveTextContent("Aparece porque eligió «Mejorar la continuidad del suministro».");
  });
});

describe("tailoring transition and next steps", () => {
  it("shows the transition, then offers the three next steps with a summary of the choices", async () => {
    renderJourney();
    await walkRoleJourney("operations-facilities", "aging-infrastructure");
    expect(screen.getByTestId("next-steps-summary")).toHaveTextContent(
      "Área: Operaciones e instalacionesPrioridades: Modernizar infraestructura envejecida",
    );
    const nav = screen.getByRole("navigation", { name: "¿Qué desea hacer ahora?" });
    expect(
      within(nav)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      expect.stringContaining("Ver recomendaciones preliminares"),
      expect.stringContaining("Refinar eligiendo retos"),
      expect.stringContaining("Explorar áreas relevantes del hospital"),
    ]);
    expect(screen.getByTestId("next-explore-areas")).toHaveTextContent("Por ejemplo:");
  });

  it("the transition message is announced as a status, then moves on after the configured time", () => {
    vi.useFakeTimers();
    renderKiosk();
    startSession();
    fireEvent.click(screen.getByTestId("path-role"));
    fireEvent.click(screen.getByTestId("persona-executive"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    fireEvent.click(screen.getByTestId("role-challenges-continue"));
    expect(within(screen.getByTestId("tailoring-screen")).getByRole("status")).toHaveTextContent(
      "Estamos adaptando la experiencia a sus prioridades.",
    );
    expect(screenId()).toBe("tailoring");
    act(() => vi.advanceTimersByTime(1_799));
    expect(screenId()).toBe("tailoring");
    act(() => vi.advanceTimersByTime(1));
    expect(screenId()).toBe("next-steps");
  });

  it("refining with challenges updates the recommendations and their reasons", async () => {
    renderJourney();
    const user = await walkRoleJourney("executive");
    await user.click(screen.getByTestId("next-refine-challenges"));
    const list = screen.getByRole("list", { name: "Retos" });
    expect(within(list).getAllByRole("button")).toHaveLength(13); // 12 challenges + “Something else”
    await user.click(screen.getByTestId("challenge-supply-continuity"));
    await user.click(screen.getByTestId("challenge-emergency-preparedness"));
    await user.click(screen.getByTestId("challenge-lifecycle-costs"));
    expect(screen.getByTestId("challenge-facility-expansion")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("challenge-count")).toHaveTextContent("3 de 3 elegidos");
    await user.click(screen.getByTestId("refine-continue"));
    const first = screen.getAllByRole("article")[0]!;
    expect(first).toHaveTextContent("Por qué es relevante");
    expect(first).toHaveTextContent(/eligió «/);
    expect(session().signals.challengeIds).toEqual([
      "supply-continuity",
      "emergency-preparedness",
      "lifecycle-costs",
    ]);
  });

  it("exploring relevant areas opens the explorer with those areas highlighted, then returns to the next steps", async () => {
    renderJourney();
    const user = await walkRoleJourney("procurement-supply");
    await user.click(screen.getByTestId("next-explore-areas"));
    expect(screen.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "campus");
    const highlighted = screen
      .getAllByRole("button")
      .filter((b) => b.dataset.highlighted === "true")
      .map((b) => b.dataset.testid);
    expect(highlighted).toContain("hotspot-campus-to-gas-plant");
    expect(screen.getByTestId("hotspot-campus-to-gas-plant")).toHaveAccessibleName(
      "Ir a: Planta de gases medicinales · Relevante para usted",
    );
    await user.click(screen.getByTestId("explorer-back"));
    expect(screenId()).toBe("next-steps");
  });

  it("“Change my area” goes back to the persona list with the current choice kept", async () => {
    renderJourney();
    const user = await walkRoleJourney("finance");
    await user.click(screen.getByTestId("next-steps-change-role"));
    expect(screen.getByTestId("persona-finance")).toHaveAttribute("aria-pressed", "true");
  });
});

describe.each([
  ["operations-facilities", "Operaciones e instalaciones"],
  ["procurement-supply", "Compras y cadena de suministro"],
  ["clinical-respiratory", "Clínica y terapia respiratoria"],
  ["executive", "Alta gerencia"],
])("integration: %s", (personaId, label) => {
  it("reaches preliminary recommendations whose reasons cite the role, writing only anonymous events", async () => {
    renderJourney();
    const user = await walkRoleJourney(personaId);
    await user.click(screen.getByTestId("next-view-recommendations"));
    const cards = screen.getAllByRole("article");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    for (const card of cards) {
      expect(within(card).getByRole("region", { name: "Por qué es relevante" })).toHaveTextContent(
        `Aparece porque seleccionó «${label}» como su área.`,
      );
      expect(card).toHaveTextContent("Contenido pendiente de validación local");
    }
    expect(screen.queryByRole("textbox")).toBeNull();

    const s = session();
    expect(SessionEventListSchema.parse(s.events).map((e) => e.type)).toEqual([
      "session-started",
      "path-chosen",
      "persona-selected",
      "recommendations-calculated",
      "next-step-chosen",
    ]);
    expect(allKeys(s).filter((k) => /email|phone|name|organization|company|contact/i.test(k))).toEqual([]);
  });
});
