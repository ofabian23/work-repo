import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderKiosk, session, startSession } from "./kiosk-harness";

const cardIds = () =>
  within(screen.getByRole("list", { name: "Recomendaciones principales" }))
    .getAllByRole("article")
    .map((a) => a.dataset.testid!.replace("recommendation-", ""));
const closeSheet = async (testId = "hotspot-sheet") => {
  fireEvent.click(
    within(screen.getByTestId(testId)).getByRole("button", { name: /Cerrar|Seguir explorando/ }),
  );
  await act(async () => undefined);
};
const events = () => session().events.map((e: { type: string }) => e.type);

async function waitForTailoring() {
  // The transition is 10 ms in these tests.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
}

function expectValueScreen() {
  const valueScreen = screen.getByTestId("recommendations-screen");
  expect(within(valueScreen).getByRole("heading", { level: 1 })).toHaveTextContent(
    "Identificamos oportunidades relevantes para usted",
  );
  expect(screen.getByTestId("recommendations-disclaimer")).toHaveTextContent(
    "no una evaluación completa ni un consejo clínico",
  );
  expect(valueScreen).toHaveTextContent(
    "Contenido de demostración pendiente de validación para Puerto Rico.",
  );
  for (const card of within(valueScreen).getAllByRole("article")) {
    expect(within(card).getByRole("region", { name: "Por qué es relevante" })).toHaveTextContent(
      "Aparece porque",
    );
    expect(card).toHaveTextContent("Contenido pendiente de validación local");
    expect(card).toHaveTextContent("Siguiente paso");
    expect(card.textContent).not.toMatch(/%|puntaje|score|puntuación/i);
  }
  expect(screen.getByTestId("send-summary")).toHaveTextContent("Solicitar mi resumen personalizado");
  expect(screen.getByTestId("continue-exploring")).toBeInTheDocument();
  expect(screen.getByTestId("review-priorities")).toBeInTheDocument();
  expect(screen.getByTestId("recommendations-start-over")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).toBeNull(); // value first: no form yet
}

describe("value screen journeys", () => {
  it("short role-based journey: role only → three recommendations → summary request", async () => {
    renderKiosk({ tailoringMs: 10 });
    startSession();
    fireEvent.click(screen.getByTestId("path-role"));
    fireEvent.click(screen.getByTestId("persona-procurement-supply"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    fireEvent.click(screen.getByTestId("role-challenges-continue"));
    await waitForTailoring();
    fireEvent.click(screen.getByTestId("next-view-recommendations"));
    expectValueScreen();
    expect(screen.getByTestId("recommendations-summary")).toHaveTextContent(
      "Su área: Compras y cadena de suministro",
    );
    expect(cardIds()).toEqual([
      "medical-gas-supply-planning",
      "cylinder-inventory-management",
      "bulk-centralized-supply",
    ]);

    fireEvent.click(screen.getByTestId("send-summary"));
    const summary = screen.getByTestId("summary-request-screen");
    expect(within(summary).getByRole("heading", { level: 1 })).toHaveTextContent("Su resumen personalizado");
    expect(within(summary).getByTestId("summary-includes")).toHaveTextContent(
      "Las recomendaciones, con el porqué de cada una",
    );
    expect(events().at(-1)).toBe("summary-requested");
    fireEvent.click(screen.getByTestId("summary-back"));
    expect(screen.getByTestId("recommendations-screen")).toBeInTheDocument();
  });

  it("challenge-based journey: two challenges, role skipped → recommendations about those priorities", async () => {
    renderKiosk({ tailoringMs: 10 });
    startSession();
    fireEvent.click(screen.getByTestId("path-challenge"));
    expect(screen.getByTestId("challenges-continue")).toBeDisabled();
    fireEvent.click(screen.getByTestId("challenge-emergency-preparedness"));
    fireEvent.click(screen.getByTestId("challenge-supply-continuity"));
    fireEvent.click(screen.getByTestId("challenges-continue"));
    expect(screen.getByTestId("persona-continue")).toHaveTextContent("Continuar sin elegir");
    fireEvent.click(screen.getByTestId("persona-continue"));
    await waitForTailoring();
    expectValueScreen();
    const summary = screen.getByTestId("recommendations-summary");
    expect(summary).toHaveTextContent(
      "Sus prioridades: Prepararse para emergencias y Mejorar la continuidad del suministro",
    );
    expect(summary).not.toHaveTextContent("Su área");
    expect(cardIds()[0]).toBe("backup-emergency-supply");
    expect(session().entryPath).toBe("challenge");
  });

  it("explorer-only journey: meaningful interaction in two scenes → recommendations from what was explored", async () => {
    renderKiosk();
    startSession();
    fireEvent.click(screen.getByTestId("path-explore"));
    fireEvent.click(screen.getByTestId("hotspot-campus-expansion"));
    await closeSheet();
    fireEvent.click(screen.getByTestId("hotspot-campus-to-gas-plant"));
    fireEvent.click(screen.getByTestId("hotspot-gas-plant-bulk-tank"));
    await closeSheet();
    fireEvent.click(screen.getByTestId("view-my-recommendations"));
    expectValueScreen();
    expect(screen.getByTestId("recommendations-summary")).toHaveTextContent(
      "Lo que exploró: Campus hospitalario y Planta de gases medicinales",
    );
    expect(cardIds()[0]).toBe("bulk-centralized-supply");
  });

  it("continuing exploration keeps progress, and the tray shows the same recommendations", async () => {
    renderKiosk();
    startSession();
    fireEvent.click(screen.getByTestId("path-explore"));
    fireEvent.click(screen.getByTestId("hotspot-campus-expansion"));
    await closeSheet();
    fireEvent.click(screen.getByTestId("hotspot-campus-to-gas-plant"));
    fireEvent.click(screen.getByTestId("hotspot-gas-plant-bulk-tank"));
    await closeSheet();
    fireEvent.click(screen.getByTestId("view-my-recommendations"));
    const before = cardIds();

    fireEvent.click(screen.getByTestId("continue-exploring"));
    expect(screen.getByTestId("explorer-screen")).toHaveAttribute("data-scene", "gas-plant");
    expect(screen.getByTestId("hotspot-gas-plant-bulk-tank")).toHaveAttribute("data-visited", "true");
    // Walking to other scenes is not evidence: nothing changes.
    fireEvent.click(screen.getByTestId("explorer-back"));
    fireEvent.click(screen.getByTestId("hotspot-campus-to-icu"));
    fireEvent.click(screen.getByTestId("recommendation-tray-button"));
    const tray = screen.getByTestId("recommendation-tray");
    expect(
      within(tray)
        .getAllByRole("listitem")
        .map((li) => li.dataset.testid!.replace("tray-item-", "")),
    ).toEqual(before);
    expect(screen.queryByTestId("recommendation-tray-new")).toBeNull();
    fireEvent.click(screen.getByTestId("recommendation-tray-view-all"));
    expect(cardIds()).toEqual(before);
    expect(screen.getByTestId("recommendations-screen")).not.toHaveTextContent(
      "Actualizamos sus recomendaciones",
    );
  });

  it("new meaningful evidence updates the recommendations, marks what is new and tells the visitor", async () => {
    renderKiosk({ tailoringMs: 10 });
    startSession();
    fireEvent.click(screen.getByTestId("path-role"));
    fireEvent.click(screen.getByTestId("persona-procurement-supply"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    fireEvent.click(screen.getByTestId("role-challenges-continue"));
    await waitForTailoring();
    fireEvent.click(screen.getByTestId("next-view-recommendations"));
    expect(cardIds()).toEqual([
      "medical-gas-supply-planning",
      "cylinder-inventory-management",
      "bulk-centralized-supply",
    ]);

    fireEvent.click(screen.getByTestId("continue-exploring"));
    fireEvent.click(screen.getByTestId("hotspot-campus-to-laboratory"));
    fireEvent.click(screen.getByTestId("hotspot-lab-safe-handling"));
    await closeSheet();
    expect(screen.getByTestId("recommendation-tray-new")).toHaveTextContent("1 nuevas");

    fireEvent.click(screen.getByTestId("view-my-recommendations"));
    const valueScreen = screen.getByTestId("recommendations-screen");
    expect(valueScreen).toHaveTextContent("Actualizamos sus recomendaciones con lo que exploró.");
    expect(cardIds()).toEqual([
      "training-operational-readiness",
      "medical-gas-supply-planning",
      "cylinder-inventory-management",
    ]);
    expect(within(valueScreen).getAllByTestId("new-badge")).toHaveLength(1);
    expect(screen.getByTestId("secondary-recommendations")).toHaveTextContent(
      "Suministro a granel o centralizado",
    );
  });

  it("reviewing priorities shows the role, adds a challenge and returns with updated recommendations", async () => {
    renderKiosk({ tailoringMs: 10 });
    startSession();
    fireEvent.click(screen.getByTestId("path-role"));
    fireEvent.click(screen.getByTestId("persona-executive"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    fireEvent.click(screen.getByTestId("role-challenges-continue"));
    await waitForTailoring();
    fireEvent.click(screen.getByTestId("next-view-recommendations"));
    fireEvent.click(screen.getByTestId("review-priorities"));
    expect(screen.getByTestId("refine-role")).toHaveTextContent("Área: Alta gerencia");
    fireEvent.click(screen.getByTestId("challenge-emergency-preparedness"));
    fireEvent.click(screen.getByTestId("refine-continue"));
    expect(screen.getByTestId("recommendations-summary")).toHaveTextContent(
      "Sus prioridades: Prepararse para emergencias",
    );
    expect(screen.getByTestId("recommendations-screen")).toHaveTextContent(
      "Actualizamos sus recomendaciones",
    );
  });

  it("“Empezar de nuevo” asks for confirmation, then resets", () => {
    const { onHardReset } = renderKiosk();
    startSession();
    fireEvent.click(screen.getByTestId("path-explore"));
    fireEvent.click(screen.getByTestId("hotspot-campus-expansion"));
    fireEvent.click(within(screen.getByTestId("hotspot-sheet")).getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByTestId("hotspot-campus-supply-network"));
    fireEvent.click(within(screen.getByTestId("hotspot-sheet")).getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByTestId("hotspot-campus-to-icu"));
    fireEvent.click(screen.getByTestId("hotspot-icu-monitoring"));
    fireEvent.click(within(screen.getByTestId("hotspot-sheet")).getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByTestId("view-my-recommendations"));
    fireEvent.click(screen.getByTestId("recommendations-start-over"));
    expect(onHardReset).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByTestId("recommendations-start-over-confirmation")).getByRole("button", {
        name: "Sí, empezar de nuevo",
      }),
    );
    expect(onHardReset).toHaveBeenCalledWith("explicit");
    expect(session()).toBeNull();
  });
});
