import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonaCard } from "@/components/cards/persona-card";
import { PERSONA_ART, PERSONA_ART_SIZES } from "@/domain/content/persona-art";
import { visibleContent } from "@/domain/content/visibility";
import { PersonaScreen } from "@/features/kiosk/journey/persona-screen";
import { loadSeedBundle } from "../helpers/schema";
import { renderUi } from "./render";

const personas = visibleContent(loadSeedBundle(), "demo").personas;
const byId = (id: string) => personas.find((p) => p.id === id)!;

describe("persona portraits on the role selection screen (ADR-064)", () => {
  it("shows the approved illustration as a decorative, responsive image", () => {
    const executive = byId("executive");
    renderUi(
      <PersonaCard persona={executive} selected={false} onSelect={() => undefined} density="compact" />,
    );
    const card = screen.getByTestId("persona-executive");
    const portrait = within(card).getByTestId("persona-portrait");
    expect(portrait.tagName).toBe("IMG");
    expect(portrait).toHaveAttribute("data-illustrated", "true");
    expect(portrait).toHaveAttribute("alt", "");
    expect(portrait).toHaveAttribute("aria-hidden", "true");
    expect(portrait).toHaveAttribute("src", executive.illustration!.src);
    expect(portrait).toHaveAttribute(
      "srcset",
      "/assets/personas/executive-160.webp 160w, /assets/personas/executive-320.webp 320w",
    );
    expect(portrait).toHaveAttribute("sizes", PERSONA_ART_SIZES);
    expect(portrait).toHaveAttribute("width", String(PERSONA_ART.width));
    expect(portrait).toHaveAttribute("height", String(PERSONA_ART.height));
    expect(portrait).toHaveAttribute("draggable", "false");
  });

  it("keeps the card's accessible name to the role's words, not the picture", () => {
    renderUi(<PersonaCard persona={byId("finance")} selected onSelect={() => undefined} density="compact" />);
    const button = screen.getByRole("button", { pressed: true });
    expect(button).toHaveAccessibleName(/^Finanzas y reembolsos/);
    expect(button.textContent).not.toMatch(/Finance Leader|png|webp/);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows a neutral tile for personas without an illustration, so the grid lines up", () => {
    renderUi(
      <PersonaCard
        persona={byId("academia-research")}
        selected={false}
        onSelect={() => undefined}
        density="compact"
      />,
    );
    const portrait = screen.getByTestId("persona-portrait");
    expect(portrait.tagName).toBe("SPAN");
    expect(portrait).toHaveAttribute("data-illustrated", "false");
    expect(portrait).toHaveAttribute("aria-hidden", "true");
  });

  it("puts the selection mark on the portrait and still selects on tap", () => {
    const onSelect = vi.fn();
    const { unmount } = renderUi(
      <PersonaCard
        persona={byId("ambulatory-homecare")}
        selected={false}
        onSelect={onSelect}
        density="compact"
      />,
    );
    const card = screen.getByTestId("persona-ambulatory-homecare");
    const mark = within(card).getByTestId("selection-mark");
    expect(mark.parentElement).toContainElement(within(card).getByTestId("persona-portrait"));
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith("ambulatory-homecare");
    unmount();
    renderUi(
      <PersonaCard persona={byId("ambulatory-homecare")} selected onSelect={onSelect} density="compact" />,
    );
    expect(screen.getByTestId("persona-ambulatory-homecare")).toHaveAttribute("aria-pressed", "true");
  });

  it("renders a portrait slot on every card of the role screen: 8 illustrations and 3 neutral tiles", () => {
    renderUi(
      <PersonaScreen
        personas={personas}
        selectedId={null}
        onSelect={() => undefined}
        onContinue={() => undefined}
        onBack={() => undefined}
      />,
    );
    const portraits = screen.getAllByTestId("persona-portrait");
    expect(portraits).toHaveLength(11);
    const illustrated = portraits.filter((p) => p.dataset.illustrated === "true");
    expect(illustrated).toHaveLength(8);
    const withoutIllustration = personas.filter((p) => !p.illustration).map((p) => p.id);
    expect(withoutIllustration.sort()).toEqual(["academia-research", "government-system", "multiple-areas"]);
  });
});
