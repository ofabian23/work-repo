import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { BottomActionBar } from "@/components/actions/bottom-action-bar";
import { ResetExperienceButton } from "@/components/actions/reset-experience-button";
import { ChallengeCard } from "@/components/cards/challenge-card";
import { PersonaCard } from "@/components/cards/persona-card";
import { RecommendationCard } from "@/components/cards/recommendation-card";
import { TouchCard } from "@/components/cards/touch-card";
import { renderUi } from "./render";

const persona = {
  id: "procurement-supply",
  label: { es: "Compras y cadena de suministro", en: "Procurement and supply chain" },
  description: { es: "Continuidad e inventario.", en: "Continuity and inventory." },
};
const challenge = {
  id: "supply-continuity",
  label: { es: "Mejorar la continuidad del suministro", en: "Improve supply continuity" },
  description: { es: "Recursos disponibles.", en: "Resources available." },
};

describe("PrimaryAction / SecondaryAction", () => {
  it("are type=button by default and call onClick", async () => {
    const onClick = vi.fn();
    renderUi(
      <>
        <PrimaryAction onClick={onClick}>Continuar</PrimaryAction>
        <SecondaryAction>Volver</SecondaryAction>
      </>,
    );
    const primary = screen.getByRole("button", { name: "Continuar" });
    expect(primary).toHaveAttribute("type", "button");
    expect(primary).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "Volver" })).toHaveAttribute("data-variant", "secondary");
    await userEvent.click(primary);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("do not fire when disabled", async () => {
    const onClick = vi.fn();
    renderUi(
      <PrimaryAction disabled onClick={onClick}>
        Enviar
      </PrimaryAction>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("use the touch-size tokens", () => {
    renderUi(<PrimaryAction size="xl">Grande</PrimaryAction>);
    expect(screen.getByRole("button", { name: "Grande" }).className).toContain("min-h-touch-lg");
  });
});

describe("BottomActionBar", () => {
  it("is a labeled region containing the actions", () => {
    renderUi(
      <BottomActionBar label="Acciones">
        <PrimaryAction>Continuar</PrimaryAction>
      </BottomActionBar>,
    );
    const region = screen.getByRole("region", { name: "Acciones" });
    expect(within(region).getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });
});

describe("ResetExperienceButton", () => {
  it("asks for confirmation before resetting", async () => {
    const onReset = vi.fn();
    renderUi(<ResetExperienceButton onReset={onReset} />);
    await userEvent.click(screen.getByRole("button", { name: "Empezar de nuevo" }));
    expect(onReset).not.toHaveBeenCalled();
    const dialog = screen.getByTestId("reset-confirmation");
    expect(dialog).toHaveAttribute("open");
    await userEvent.click(within(dialog).getByRole("button", { name: "No, continuar" }));
    expect(onReset).not.toHaveBeenCalled();
    expect(dialog).not.toHaveAttribute("open");

    await userEvent.click(screen.getByRole("button", { name: "Empezar de nuevo" }));
    await userEvent.click(
      within(screen.getByTestId("reset-confirmation")).getByRole("button", { name: "Sí, empezar de nuevo" }),
    );
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("can reset immediately when confirmation is disabled", async () => {
    const onReset = vi.fn();
    renderUi(<ResetExperienceButton onReset={onReset} requireConfirmation={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Empezar de nuevo" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("TouchCard", () => {
  it("is a toggle button operable with keyboard (Enter and Space)", async () => {
    const onSelect = vi.fn();
    renderUi(<TouchCard title="Opción" selected={false} onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: /Opción/ });
    expect(card).toHaveAttribute("aria-pressed", "false");
    card.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("announces the selected state", () => {
    renderUi(<TouchCard title="Opción" selected onSelect={() => undefined} />);
    expect(screen.getByRole("button", { name: /Opción/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Seleccionado")).toHaveClass("sr-only");
  });

  it("renders a static card without a button when not selectable", () => {
    renderUi(<TouchCard title="Solo información" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Solo información")).toBeInTheDocument();
  });

  it("stays focusable but inert when disabled, and shows the reason", async () => {
    const onSelect = vi.fn();
    renderUi(
      <TouchCard title="Opción" selected={false} disabled hint="Límite alcanzado" onSelect={onSelect} />,
    );
    const card = screen.getByRole("button", { name: /Opción/ });
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).not.toBeDisabled();
    await userEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText("Límite alcanzado")).toBeInTheDocument();
  });
});

describe("PersonaCard / ChallengeCard", () => {
  it("PersonaCard shows localized content and reports its id", async () => {
    const onSelect = vi.fn();
    renderUi(<PersonaCard persona={persona} selected={false} onSelect={onSelect} />, { language: "en" });
    await userEvent.click(screen.getByRole("button", { name: /Procurement and supply chain/ }));
    expect(onSelect).toHaveBeenCalledWith("procurement-supply");
  });

  it("ChallengeCard is disabled with an explanation once the limit is reached", async () => {
    const onToggle = vi.fn();
    renderUi(
      <ChallengeCard
        challenge={challenge}
        selected={false}
        limitReached
        maxSelections={3}
        onToggle={onToggle}
      />,
    );
    const card = screen.getByRole("button", { name: /Mejorar la continuidad/ });
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/Puede elegir hasta 3/)).toBeInTheDocument();
    await userEvent.click(card);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("ChallengeCard stays toggleable when selected even at the limit", async () => {
    const onToggle = vi.fn();
    renderUi(
      <ChallengeCard challenge={challenge} selected limitReached maxSelections={3} onToggle={onToggle} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Mejorar la continuidad/ }));
    expect(onToggle).toHaveBeenCalledWith("supply-continuity");
  });
});

describe("RecommendationCard", () => {
  const props = {
    rank: 1,
    title: "Suministro de respaldo y emergencias",
    summary: "Planificación de fuentes de respaldo.",
    whyThisAppeared: "Aparece porque eligió «Prepararse para emergencias».",
    relevance: "Relevante para planes de contingencia.",
    nextStep: "Repase su plan con un especialista.",
    relatedAreas: ["Planta de gases medicinales"],
  };

  it("always shows the 'Why this appeared' explanation and never a score", () => {
    renderUi(<RecommendationCard {...props} pendingValidation={false} />);
    const article = screen.getByRole("article", { name: /Recomendación 1: Suministro de respaldo/ });
    expect(within(article).getByText("Por qué es relevante")).toBeInTheDocument();
    expect(within(article).getByText(props.whyThisAppeared)).toBeInTheDocument();
    expect(within(article).getByText("Planta de gases medicinales")).toBeInTheDocument();
    expect(screen.queryByTestId("pending-validation")).toBeNull();
  });

  it("shows the pending-validation badge for assumed content", () => {
    renderUi(<RecommendationCard {...props} pendingValidation />, { language: "en" });
    expect(screen.getByTestId("pending-validation")).toHaveTextContent("Content pending local validation");
  });
});
