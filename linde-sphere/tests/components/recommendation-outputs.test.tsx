import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderKiosk, session, startSession } from "./kiosk-harness";

async function viewRecommendations(personaId: string, ...challengeIds: string[]) {
  const user = userEvent.setup();
  renderKiosk({ tailoringMs: 10 });
  startSession();
  await user.click(screen.getByTestId("path-role"));
  await user.click(screen.getByTestId(`persona-${personaId}`));
  await user.click(screen.getByTestId("persona-continue"));
  for (const id of challengeIds) await user.click(screen.getByTestId(`challenge-${id}`));
  await user.click(screen.getByTestId("role-challenges-continue"));
  await user.click(await screen.findByTestId("next-view-recommendations"));
  return user;
}

describe("recommendation outputs on screen", () => {
  it("shows three primary cards with relevance in words", async () => {
    await viewRecommendations("procurement-supply", "cylinder-inventory");
    const primary = screen.getByRole("list", { name: "Recomendaciones principales" });
    const cards = within(primary).getAllByRole("article");
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByTestId("relevance-label")).toHaveTextContent("Muy relevante");
    for (const card of cards) {
      expect(within(card).getByTestId("relevance-label").textContent).toMatch(
        /^(Muy relevante|Relevante|Posiblemente relevante)$/,
      );
      expect(card.textContent).not.toMatch(/%/);
    }
  });

  it("lists up to three secondary recommendations after the primary ones", async () => {
    await viewRecommendations(
      "executive",
      "supply-continuity",
      "emergency-preparedness",
      "facility-expansion",
    );
    const secondary = screen.getByTestId("secondary-recommendations");
    expect(within(secondary).getByRole("heading", { level: 2 })).toHaveTextContent(
      "También podría interesarle",
    );
    const extra = within(secondary).getAllByRole("listitem");
    expect(extra.length).toBeGreaterThan(0);
    expect(extra.length).toBeLessThanOrEqual(3);
    expect(extra[0]).toHaveTextContent("Aparece porque");
  });

  it("the relevant scene opens the explorer right there", async () => {
    const user = await viewRecommendations("procurement-supply", "cylinder-inventory");
    const top = session().recommendations.items[0];
    const button = screen.getByTestId(`view-scene-${top.solutionId}`);
    expect(button).toHaveTextContent("Verlo en el hospital:");
    await user.click(button);
    expect(screen.getByTestId("explorer-screen")).toHaveAttribute("data-scene", top.sceneId);
  });

  it("the stored snapshot carries internal fields the visitor never sees", async () => {
    await viewRecommendations("clinical-respiratory");
    const item = session().recommendations.items[0];
    expect(item).toMatchObject({ validationStatus: "assumed", tier: "primary" });
    expect(Number.isInteger(item.score)).toBe(true);
    const card = screen.getByTestId(`recommendation-${item.solutionId}`);
    expect(card).not.toHaveTextContent("assumed");
    expect(card).toHaveTextContent("Contenido pendiente de validación local");
  });
});
