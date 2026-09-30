import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** The lead form is loaded on demand (ADR-058); a failed download must never strand the visitor. */
describe("lazy lead form", () => {
  afterEach(() => {
    vi.doUnmock("@/features/kiosk/lead/lead-form-screen");
    vi.resetModules();
  });

  it("shows a recoverable error when its code cannot be loaded; retry loads it, back returns", async () => {
    vi.resetModules();
    let available = false;
    vi.doMock("@/features/kiosk/lead/lead-form-screen", () => {
      if (!available) throw new Error("chunk load failed");
      return { LeadFormScreen: () => <p>formulario cargado</p> };
    });
    // Fresh module registry: the provider must come from the same registry as the lazy screen.
    const { LanguageProvider } = await import("@/lib/i18n/language-provider");
    const { LazyLeadFormScreen } = await import("@/features/kiosk/lead/lazy-lead-form");
    const onCancel = vi.fn();
    const props = { onCancel } as unknown as Parameters<typeof LazyLeadFormScreen>[0];
    render(
      <LanguageProvider initialLanguage="es">
        <LazyLeadFormScreen {...props} />
      </LanguageProvider>,
    );

    expect(await screen.findByTestId("error-state")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    available = true;
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(await screen.findByText("formulario cargado")).toBeInTheDocument();
  });
});
