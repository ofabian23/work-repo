import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SolutionPanel } from "@/components/content/solution-panel";
import { HotspotButton } from "@/components/explorer/hotspot-button";
import { ConsentCheckbox } from "@/components/forms/consent-checkbox";
import { FormField } from "@/components/forms/form-field";
import { ProgressIndicator } from "@/components/navigation/progress-indicator";
import { SceneBreadcrumb } from "@/components/navigation/scene-breadcrumb";
import { Modal, Sheet } from "@/components/overlay/dialog";
import { InactivityWarning } from "@/components/overlay/inactivity-warning";
import { renderUi } from "./render";

describe("ProgressIndicator", () => {
  it("states the step in text and marks the current step", () => {
    renderUi(<ProgressIndicator current={2} total={4} steps={["Área", "Retos", "Explorar", "Informe"]} />);
    expect(screen.getByRole("group", { name: "Progreso" })).toHaveTextContent("Paso 2 de 4");
    expect(screen.getByText("Retos")).toHaveAttribute("aria-current", "step");
  });

  it("clamps out-of-range values", () => {
    renderUi(<ProgressIndicator current={9} total={3} />, { language: "en" });
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
  });
});

describe("SceneBreadcrumb", () => {
  it("renders ancestors as buttons and the current scene as the current page", async () => {
    const onNavigate = vi.fn();
    renderUi(
      <SceneBreadcrumb
        items={[
          { id: "campus", label: "Campus hospitalario" },
          { id: "icu", label: "Unidad de cuidado intensivo" },
        ]}
        onNavigate={onNavigate}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Ubicación en el hospital" });
    expect(within(nav).getByText("Unidad de cuidado intensivo")).toHaveAttribute("aria-current", "page");
    await userEvent.click(within(nav).getByRole("button", { name: "Campus hospitalario" }));
    expect(onNavigate).toHaveBeenCalledWith("campus");
  });
});

describe("HotspotButton", () => {
  const base = {
    x: 40,
    y: 36,
    type: "solution" as const,
    label: "Tanque de almacenamiento",
    accessibleLabel: "Ver suministro centralizado",
  };

  it("is positioned by percentage and uses the accessible label", async () => {
    const onActivate = vi.fn();
    renderUi(<HotspotButton {...base} onActivate={onActivate} />);
    const button = screen.getByRole("button", { name: "Ver suministro centralizado" });
    expect(button).toHaveStyle({ left: "40%", top: "36%" });
    expect(button).toHaveAttribute("data-hotspot-type", "solution");
    expect(screen.getByText("Tanque de almacenamiento")).toBeInTheDocument();
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("stops pulsing and announces the visited state", () => {
    renderUi(<HotspotButton {...base} visited onActivate={() => undefined} />);
    expect(
      screen.getByRole("button", { name: "Ver suministro centralizado (Visitado)" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("hotspot-pulse")).toBeNull();
  });

  it("only animates the pulse when motion is allowed", () => {
    renderUi(<HotspotButton {...base} onActivate={() => undefined} />);
    expect(screen.getByTestId("hotspot-pulse").className).toContain("motion-safe:animate-pulse-ring");
  });
});

function SheetHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Sheet
        open={open}
        testId="sheet"
        title="Tanque de almacenamiento"
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <p>Contenido del panel</p>
      </Sheet>
    </>
  );
}

describe("Sheet / Modal", () => {
  it("opens as a labeled dialog and closes with the close button", async () => {
    renderUi(<SheetHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const dialog = screen.getByTestId("sheet");
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAttribute("data-variant", "sheet");
    expect(dialog).toHaveAccessibleName("Tanque de almacenamiento");
    expect(within(dialog).getByText("Contenido del panel")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  it("closes on Esc (cancel event) and on backdrop tap", async () => {
    const onClose = vi.fn();
    renderUi(<SheetHarness onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent(screen.getByTestId("sheet"), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(screen.getByTestId("sheet"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("Modal can hide the close button and renders its footer actions", () => {
    renderUi(
      <Modal
        open
        title="Aviso"
        onClose={() => undefined}
        hideCloseButton
        footer={<button type="button">Aceptar</button>}
      />,
    );
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
  });
});

describe("InactivityWarning", () => {
  it("shows the countdown and routes both choices", async () => {
    const onContinue = vi.fn();
    const onReset = vi.fn();
    renderUi(<InactivityWarning open secondsRemaining={12} onContinue={onContinue} onReset={onReset} />);
    const dialog = screen.getByTestId("inactivity-warning");
    expect(dialog).toHaveAccessibleName("¿Sigue ahí?");
    expect(dialog).toHaveAccessibleDescription(
      "Por su privacidad, la experiencia se reiniciará en 12 segundos.",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Empezar de nuevo" }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("FormField", () => {
  it("associates label, hint and error with the input", () => {
    renderUi(
      <FormField
        label="Correo electrónico"
        type="email"
        required
        hint="Le enviaremos el informe."
        error="Correo inválido"
      />,
    );
    const input = screen.getByLabelText("Correo electrónico");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAccessibleDescription("Le enviaremos el informe. Correo inválido");
  });

  it("marks optional fields visibly and accepts typing", async () => {
    renderUi(<FormField label="Teléfono" type="tel" />);
    expect(screen.getByText("(Opcional)")).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: /Teléfono/ });
    await userEvent.type(input, "787");
    expect(input).toHaveValue("787");
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});

describe("ConsentCheckbox", () => {
  function Harness({ required }: { required?: boolean }) {
    const [checked, setChecked] = useState(false);
    return (
      <ConsentCheckbox
        label="Autorizo el envío del informe."
        checked={checked}
        onChange={setChecked}
        required={required}
      />
    );
  }

  it("is unchecked by default and toggles from the label or keyboard", async () => {
    renderUi(<Harness required />);
    const checkbox = screen.getByRole("checkbox", { name: /Autorizo el envío del informe/ });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBeRequired();
    await userEvent.click(screen.getByText("Autorizo el envío del informe."));
    expect(checkbox).toBeChecked();
    checkbox.focus();
    await userEvent.keyboard(" ");
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("Obligatorio")).toBeInTheDocument();
  });

  it("exposes an error to assistive technology", () => {
    renderUi(
      <ConsentCheckbox
        label="Consentimiento"
        checked={false}
        onChange={() => undefined}
        required
        error="Es necesario"
      />,
    );
    const checkbox = screen.getByRole("checkbox", { name: /Consentimiento/ });
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAccessibleDescription("Es necesario");
  });
});

describe("SolutionPanel", () => {
  it("toggles an explicit interest per solution", async () => {
    function Harness() {
      const [ids, setIds] = useState<string[]>([]);
      return (
        <SolutionPanel
          solutions={[
            {
              id: "bulk-centralized-supply",
              title: "Suministro a granel",
              summary: "Opciones.",
              pendingValidation: true,
            },
          ]}
          interestIds={ids}
          onToggleInterest={(id) =>
            setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
          }
        />
      );
    }
    renderUi(<Harness />);
    const toggle = screen.getByRole("button", { name: "Añadir a mis intereses" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Añadido a mis intereses" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("pending-validation")).toBeInTheDocument();
  });
});
