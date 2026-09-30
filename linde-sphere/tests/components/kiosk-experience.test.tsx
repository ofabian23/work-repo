import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderKiosk, session, startSession } from "./kiosk-harness";

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.lang = "es";
});

describe("starting a session", () => {
  it("shows the attract screen first, with no session and no contact fields", () => {
    renderKiosk();
    const attract = screen.getByTestId("attract-screen");
    expect(within(attract).getByRole("heading", { level: 1 })).toHaveTextContent("Linde Sphere");
    expect(within(attract).getByTestId("attract-phrase")).toHaveTextContent("Explore un hospital en minutos");
    expect(attract).toHaveTextContent("Toque para comenzar");
    expect(attract).toHaveTextContent("Touch to begin");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByTestId("reset-experience")).toBeNull();
    expect(session()).toBeNull();
  });

  it("touching the attract screen starts a session with an opaque id and opens the welcome screen", async () => {
    renderKiosk();
    await userEvent.click(screen.getByRole("button", { name: "Comenzar la experiencia Linde Sphere" }));
    const welcome = screen.getByTestId("welcome-screen");
    const heading = within(welcome).getByRole("heading", { level: 1, name: "¿Cómo desea comenzar?" });
    expect(heading).toHaveFocus();
    expect(session().id).toMatch(/^[0-9a-f-]{36}$/);
    expect(session().signals.personaId).toBeNull();
  });

  it("the welcome screen offers three paths, personalization, privacy and reset — but no contact form", () => {
    renderKiosk();
    startSession();
    const nav = screen.getByRole("navigation", { name: "Caminos para comenzar" });
    expect(within(nav).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("welcome-promises")).toHaveTextContent("Recomendaciones personalizadas");
    expect(screen.getByTestId("privacy-link")).toBeInTheDocument();
    expect(screen.getByTestId("reset-experience")).toBeInTheDocument();
    expect(screen.getByTestId("accessibility-button")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("can be started with the keyboard", async () => {
    renderKiosk();
    screen.getByTestId("attract-start").focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("welcome-screen")).toBeInTheDocument();
  });
});

describe("language switching", () => {
  it("switches attract and welcome content between Spanish and English", async () => {
    renderKiosk();
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByTestId("attract-phrase")).toHaveTextContent("Explore a hospital in minutes");
    expect(screen.getByTestId("attract-screen")).toHaveTextContent("Touch to begin");
    expect(document.documentElement.lang).toBe("en");
    startSession();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How would you like to begin?");
    await userEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("¿Cómo desea comenzar?");
  });

  it("reverts a passer-by's language change on the attract screen after idling", () => {
    vi.useFakeTimers();
    renderKiosk();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(document.documentElement.lang).toBe("en");
    act(() => vi.advanceTimersByTime(5_000));
    expect(document.documentElement.lang).toBe("es");
    expect(screen.getByTestId("attract-phrase")).toHaveTextContent("Explore un hospital en minutos");
  });
});

const PATH_SCREENS = {
  role: { screen: "persona-screen", title: "¿En qué área trabaja?", back: "persona-back" },
  challenge: { screen: "path-screen-challenge", title: "Necesito…", back: "back-to-welcome" },
  explore: { screen: "explorer-screen", title: "Campus hospitalario", back: "explorer-back" },
} as const;

describe("entry paths", () => {
  it.each(["role", "challenge", "explore"] as const)(
    "selecting '%s' opens its screen and records the path",
    async (path) => {
      renderKiosk();
      startSession();
      await userEvent.click(screen.getByTestId(`path-${path}`));
      const pathScreen = screen.getByTestId(PATH_SCREENS[path].screen);
      expect(within(pathScreen).getByRole("heading", { level: 1 })).toHaveTextContent(
        PATH_SCREENS[path].title,
      );
      expect(within(pathScreen).getByRole("heading", { level: 1 })).toHaveFocus();
      expect(session().entryPath).toBe(path);
    },
  );

  it.each(["role", "challenge", "explore"] as const)(
    "returns from '%s' to the welcome screen keeping the session",
    async (path) => {
      renderKiosk();
      startSession();
      const id = session().id;
      await userEvent.click(screen.getByTestId(`path-${path}`));
      await userEvent.click(screen.getByTestId(PATH_SCREENS[path].back));
      expect(screen.getByTestId("welcome-screen")).toBeInTheDocument();
      expect(session().id).toBe(id);
    },
  );
});

describe("resetting a session", () => {
  it("explicit reset (confirmed) clears everything, restores Spanish and triggers the hard reload", async () => {
    const { onHardReset } = renderKiosk();
    startSession();
    const firstId = session().id;
    await userEvent.click(screen.getByTestId("path-challenge"));
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    await userEvent.click(screen.getByTestId("accessibility-button"));
    await userEvent.click(screen.getByTestId("a11y-largeText"));
    expect(document.documentElement.dataset.textSize).toBe("large");

    await userEvent.click(screen.getByTestId("reset-experience"));
    await userEvent.click(
      within(screen.getByTestId("reset-confirmation")).getByRole("button", { name: "Yes, start over" }),
    );

    expect(onHardReset).toHaveBeenCalledWith("explicit");
    expect(screen.getByTestId("attract-screen")).toBeInTheDocument();
    expect(session()).toBeNull();
    expect(document.documentElement.lang).toBe("es");
    expect(document.documentElement.dataset.textSize).toBeUndefined();

    // The next visitor starts clean.
    startSession();
    expect(session().id).not.toBe(firstId);
    expect(session().entryPath).toBeNull();
    expect(session().accessibility).toEqual({ largeText: false, reduceMotion: false });
    expect(screen.getByTestId("welcome-screen")).toBeInTheDocument();
  });

  it("cancelling the reset keeps the session", async () => {
    const { onHardReset } = renderKiosk();
    startSession();
    await userEvent.click(screen.getByTestId("reset-experience"));
    await userEvent.click(
      within(screen.getByTestId("reset-confirmation")).getByRole("button", { name: "No, continuar" }),
    );
    expect(onHardReset).not.toHaveBeenCalled();
    expect(screen.getByTestId("welcome-screen")).toBeInTheDocument();
  });

  it("warns after inactivity and resets on timeout", () => {
    vi.useFakeTimers();
    const { onHardReset } = renderKiosk({ idle: { warningAfterMs: 1_000, countdownMs: 3_000 } });
    startSession();
    fireEvent.click(screen.getByTestId("path-role"));
    act(() => vi.advanceTimersByTime(1_000));
    const warning = screen.getByTestId("inactivity-warning");
    expect(warning).toHaveAttribute("open");
    expect(warning).toHaveAccessibleDescription(/3 segundos/);
    act(() => vi.advanceTimersByTime(1_000));
    expect(warning).toHaveAccessibleDescription(/2 segundos/);
    act(() => vi.advanceTimersByTime(2_000));
    expect(onHardReset).toHaveBeenCalledWith("timeout");
    expect(screen.getByTestId("attract-screen")).toBeInTheDocument();
    expect(session()).toBeNull();
  });

  it("'Continue' keeps the session and restarts the idle period", () => {
    vi.useFakeTimers();
    const { onHardReset } = renderKiosk({ idle: { warningAfterMs: 1_000, countdownMs: 3_000 } });
    startSession();
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.click(
      within(screen.getByTestId("inactivity-warning")).getByRole("button", { name: "Continuar" }),
    );
    expect(screen.getByTestId("inactivity-warning")).not.toHaveAttribute("open");
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByTestId("inactivity-warning")).not.toHaveAttribute("open");
    act(() => vi.advanceTimersByTime(10_000));
    expect(onHardReset).toHaveBeenCalledWith("timeout");
  });

  it("any touch delays the warning; 'Start over' in the warning resets immediately", () => {
    vi.useFakeTimers();
    const { onHardReset } = renderKiosk({ idle: { warningAfterMs: 1_000, countdownMs: 3_000 } });
    startSession();
    act(() => vi.advanceTimersByTime(800));
    fireEvent.pointerDown(window);
    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByTestId("inactivity-warning")).not.toHaveAttribute("open");
    act(() => vi.advanceTimersByTime(200));
    const warning = screen.getByTestId("inactivity-warning");
    expect(warning).toHaveAttribute("open");
    fireEvent.pointerDown(window); // ignored while the warning is open
    fireEvent.click(within(warning).getByRole("button", { name: "Empezar de nuevo" }));
    expect(onHardReset).toHaveBeenCalledWith("explicit");
    expect(screen.getByTestId("attract-screen")).toBeInTheDocument();
  });

  it("no inactivity timer runs on the attract screen", () => {
    vi.useFakeTimers();
    const { onHardReset } = renderKiosk({ idle: { warningAfterMs: 1_000, countdownMs: 1_000 } });
    act(() => vi.advanceTimersByTime(10_000));
    expect(onHardReset).not.toHaveBeenCalled();
    expect(screen.getByTestId("inactivity-warning")).not.toHaveAttribute("open");
  });

  it("the attract screen restarts from its first phrase after a reset", () => {
    vi.useFakeTimers();
    renderKiosk();
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByTestId("attract-screen")).toHaveAttribute("data-phrase", "2");
    startSession();
    fireEvent.click(screen.getByTestId("reset-experience"));
    fireEvent.click(
      within(screen.getByTestId("reset-confirmation")).getByRole("button", { name: "Sí, empezar de nuevo" }),
    );
    expect(screen.getByTestId("attract-screen")).toHaveAttribute("data-phrase", "0");
  });
});

describe("welcome extras", () => {
  it("privacy link opens a plain-language privacy sheet", async () => {
    renderKiosk();
    startSession();
    await userEvent.click(screen.getByTestId("privacy-link"));
    const sheet = screen.getByTestId("privacy-sheet");
    expect(sheet).toHaveAttribute("open");
    expect(sheet).toHaveTextContent("No le pedimos datos de contacto para explorar");
  });

  it("accessibility options apply to the document and are per visitor", async () => {
    renderKiosk();
    startSession();
    await userEvent.click(screen.getByTestId("accessibility-button"));
    const motion = screen.getByTestId("a11y-reduceMotion");
    expect(motion).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(motion);
    expect(motion).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.motion).toBe("reduce");
    expect(session().accessibility.reduceMotion).toBe(true);
  });
});
