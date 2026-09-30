import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StatusBanner } from "@/components/feedback/status-banner";
import { AppShell } from "@/components/shell/app-shell";
import { BrandWordmark } from "@/components/shell/brand-wordmark";
import { KioskHeader } from "@/components/shell/kiosk-header";
import { LanguageToggle } from "@/components/shell/language-toggle";
import { brandConfig } from "@/lib/config/brand-config";
import { renderUi } from "./render";

describe("LanguageToggle", () => {
  it("switches the UI language and <html lang>", async () => {
    renderUi(
      <>
        <LanguageToggle />
        <LoadingState />
      </>,
    );
    expect(screen.getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("KioskHeader / AppShell / BrandWordmark", () => {
  it("header shows the product name, language toggle and optional actions", () => {
    renderUi(<KioskHeader actions={<button type="button">Acción</button>} />);
    expect(screen.getByRole("banner")).toHaveTextContent("Linde Sphere");
    expect(screen.getByRole("group", { name: "Idioma" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acción" })).toBeInTheDocument();
  });

  it("AppShell shows the demo-mode indicator only in demo mode", () => {
    const { unmount } = renderUi(<AppShell contentMode="demo">contenido</AppShell>);
    expect(screen.getByRole("main")).toHaveTextContent("contenido");
    expect(screen.getByTestId("demo-mode-indicator")).toBeInTheDocument();
    unmount();
    renderUi(<AppShell contentMode="production">contenido</AppShell>);
    expect(screen.queryByTestId("demo-mode-indicator")).toBeNull();
  });

  it("never renders a logo unless the branding is approved and a local logo is configured", () => {
    const logo = { src: "/assets/brand/logo.svg", alt: { es: "Logotipo", en: "Logo" } };
    const { unmount } = renderUi(
      <BrandWordmark brand={{ ...brandConfig, logo, approvalStatus: "placeholder" }} />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    unmount();
    renderUi(<BrandWordmark brand={{ ...brandConfig, logo, approvalStatus: "approved" }} />);
    expect(screen.getByRole("img", { name: "Logotipo" })).toHaveAttribute("src", "/assets/brand/logo.svg");
  });
});

describe("StatusBanner", () => {
  it("announces errors immediately and other tones politely", () => {
    renderUi(
      <>
        <StatusBanner tone="error" title="No pudimos guardar" />
        <StatusBanner tone="success" title="Guardado" />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos guardar");
    expect(screen.getByRole("status")).toHaveTextContent("Guardado");
  });
});

describe("LoadingState / EmptyState / ErrorState", () => {
  it("LoadingState is a status region with a label", () => {
    renderUi(<LoadingState label="Preparando recomendaciones" />);
    expect(screen.getByRole("status")).toHaveTextContent("Preparando recomendaciones");
  });

  it("EmptyState uses a default title and renders its action", () => {
    renderUi(<EmptyState action={<button type="button">Explorar</button>} />, { language: "en" });
    expect(screen.getByRole("heading", { name: "Nothing to show yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explorar" })).toBeInTheDocument();
  });

  it("ErrorState offers retry and home, and shows only an opaque reference", async () => {
    const onRetry = vi.fn();
    const onHome = vi.fn();
    renderUi(<ErrorState digest="abc123" onRetry={onRetry} onHome={onHome} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Referencia: abc123");
    await userEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    await userEvent.click(screen.getByRole("button", { name: "Volver al inicio" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onHome).toHaveBeenCalledOnce();
  });
});
