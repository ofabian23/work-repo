"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { EntryPath } from "@/domain/session/visitor-session";
import { appConfig } from "@/lib/config/app-config";
import { useLanguage } from "@/lib/i18n/language-provider";
import {
  INITIAL_KIOSK_STATE,
  kioskReducer,
  type KioskAction,
  type KioskState,
  type ResetReason,
} from "./kiosk-state";
import { createSessionId } from "./session-id";

type KioskSessionContextValue = {
  state: KioskState;
  dispatch: (
    action: Exclude<
      KioskAction,
      { type: "START_SESSION" } | { type: "RESET" } | { type: "REQUEST_RESET" } | { type: "RESET_DONE" }
    >,
  ) => void;
  startSession: () => void;
  choosePath: (path: EntryPath) => void;
  goToWelcome: () => void;
  /**
   * Privacy reset: clears all visitor state, restores Spanish and default accessibility, then hard-reloads
   * (fresh session id on the next start). Deferred while a lead submission is completing (ADR-055).
   */
  reset: (reason: ResetReason) => void;
};

const KioskSessionContext = createContext<KioskSessionContextValue | null>(null);

/** Default hard reset: replaces the page (no history entry) so no JS memory survives (ADR-004). */
export function hardReloadToStart(): void {
  window.location.replace(appConfig.routes.home);
}

/**
 * Lightweight local session store (useReducer + context, no global state library; ADR-005, ADR-047).
 * State lives in memory only — never in localStorage, sessionStorage, IndexedDB or cookies.
 */
export function KioskSessionProvider({
  children,
  onHardReset = hardReloadToStart,
  createId = createSessionId,
  now = () => new Date(),
}: {
  children: ReactNode;
  /** Injected in tests; in the app it reloads the page after the in-memory reset. */
  onHardReset?: (reason: ResetReason) => void;
  createId?: () => string;
  now?: () => Date;
}) {
  const [state, rawDispatch] = useReducer(kioskReducer, INITIAL_KIOSK_STATE);
  const { setLanguage } = useLanguage();

  // Apply the visitor's accessibility preferences to the document; cleared when the session ends.
  const accessibility = state.session?.accessibility;
  useEffect(() => {
    const root = document.documentElement;
    if (accessibility?.largeText) root.dataset.textSize = "large";
    else delete root.dataset.textSize;
    if (accessibility?.reduceMotion) root.dataset.motion = "reduce";
    else delete root.dataset.motion;
  }, [accessibility?.largeText, accessibility?.reduceMotion]);

  const reset = useCallback((reason: ResetReason) => rawDispatch({ type: "REQUEST_RESET", reason }), []);

  // Carry out a reset once the store has cleared the session (the "resetting" state).
  useEffect(() => {
    if (!state.resetting) return;
    setLanguage(appConfig.defaultLanguage);
    delete document.documentElement.dataset.textSize;
    delete document.documentElement.dataset.motion;
    onHardReset(state.resetting);
    rawDispatch({ type: "RESET_DONE" });
  }, [state.resetting, onHardReset, setLanguage]);

  // A reset requested during a submission runs as soon as the submission settles.
  useEffect(() => {
    if (state.deferredReset && state.leadFlow !== "submitting") {
      rawDispatch({ type: "REQUEST_RESET", reason: state.deferredReset });
    }
  }, [state.deferredReset, state.leadFlow]);

  // Returning to this page from the browser's back/forward cache must never show a previous visitor's
  // screen: reload it from the server instead.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const value = useMemo<KioskSessionContextValue>(
    () => ({
      state,
      dispatch: rawDispatch,
      startSession: () =>
        rawDispatch({ type: "START_SESSION", id: createId(), startedAt: now().toISOString() }),
      choosePath: (path) => rawDispatch({ type: "CHOOSE_PATH", path }),
      goToWelcome: () => rawDispatch({ type: "GO_TO_WELCOME" }),
      reset,
    }),
    [state, reset, createId, now],
  );

  return <KioskSessionContext value={value}>{children}</KioskSessionContext>;
}

export function useKioskSession(): KioskSessionContextValue {
  const context = useContext(KioskSessionContext);
  if (!context) throw new Error("useKioskSession must be used inside <KioskSessionProvider>");
  return context;
}
