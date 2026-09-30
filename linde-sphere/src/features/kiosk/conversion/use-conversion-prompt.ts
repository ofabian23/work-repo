"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { conversionPromptDecision, type ConversionPromptConfig } from "./conversion-policy";

const FORM_FIELD = "input, textarea, select, [contenteditable='true']";

/**
 * Runs `fn` right after the current effect (a microtask, not a timer tick), unless cleaned up first.
 * Avoids setting state synchronously inside an effect body.
 */
function afterEffect(fn: () => void): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) fn();
  });
  return () => {
    cancelled = true;
  };
}

function subscribeDialogs(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["open"],
  });
  return () => observer.disconnect();
}

function subscribeFocus(onChange: () => void) {
  // focusout fires before the next element is focused; check again once focus has settled.
  const deferred = () => setTimeout(onChange, 0);
  document.addEventListener("focusin", onChange);
  document.addEventListener("focusout", deferred);
  return () => {
    document.removeEventListener("focusin", onChange);
    document.removeEventListener("focusout", deferred);
  };
}

/** True while any <dialog> is open anywhere in the document (all kiosk modals and sheets are dialogs). */
const useAnyDialogOpen = () =>
  useSyncExternalStore(
    subscribeDialogs,
    () => document.querySelector("dialog[open]") !== null,
    () => false,
  );

/** True while a form field has focus (the visitor is entering data). */
const useDataEntry = () =>
  useSyncExternalStore(
    subscribeFocus,
    () => document.activeElement?.matches(FORM_FIELD) ?? false,
    () => false,
  );

/**
 * Shows the conversion prompt when `conversionPromptDecision` allows it and schedules the next check when
 * a time-based rule (interval, scene settle, quiet time) is what blocks it. `sceneKey` changes whenever
 * the visitor moves to another scene.
 */
export function useConversionPrompt({
  ready,
  screenAllowed,
  sceneKey,
  config,
  onShown,
  now = Date.now,
}: {
  ready: boolean;
  screenAllowed: boolean;
  sceneKey: string | null;
  config: ConversionPromptConfig;
  onShown: () => void;
  now?: () => number;
}) {
  const modalOpen = useAnyDialogOpen();
  const dataEntry = useDataEntry();
  const [visible, setVisible] = useState(false);
  const [tick, setTick] = useState(0);
  const lastShownAt = useRef<number | null>(null);
  const lastSceneChangeAt = useRef<number | null>(null);
  const lastInterruptionEndAt = useRef<number | null>(null);
  const onShownRef = useRef(onShown);
  useEffect(() => {
    onShownRef.current = onShown;
  }, [onShown]);

  // A new scene restarts the settle time.
  const previousScene = useRef(sceneKey);
  useEffect(() => {
    if (previousScene.current !== sceneKey) {
      previousScene.current = sceneKey;
      lastSceneChangeAt.current = now();
      return afterEffect(() => setTick((t) => t + 1));
    }
  }, [sceneKey, now]);

  // The end of a dialog or of data entry starts a short quiet time.
  const interrupted = modalOpen || dataEntry;
  const wasInterrupted = useRef(interrupted);
  useEffect(() => {
    if (wasInterrupted.current && !interrupted) lastInterruptionEndAt.current = now();
    wasInterrupted.current = interrupted;
  }, [interrupted, now]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setVisible(false), config.visibleMs);
      return () => clearTimeout(timer);
    }
    const decision = conversionPromptDecision(
      {
        now: now(),
        ready,
        screenAllowed,
        modalOpen,
        dataEntry,
        lastSceneChangeAt: lastSceneChangeAt.current,
        lastInterruptionEndAt: lastInterruptionEndAt.current,
        lastShownAt: lastShownAt.current,
      },
      config,
    );
    if (decision.show) {
      return afterEffect(() => {
        lastShownAt.current = now();
        setVisible(true);
        onShownRef.current();
      });
    }
    if (decision.retryAt !== null) {
      const timer = setTimeout(() => setTick((t) => t + 1), Math.max(decision.retryAt - now(), 0));
      return () => clearTimeout(timer);
    }
  }, [visible, ready, screenAllowed, modalOpen, dataEntry, tick, config, now]);

  // Leaving the allowed screens hides the prompt (it belongs to that context).
  const shown = visible && screenAllowed && !modalOpen;
  const hide = useCallback(() => setVisible(false), []);
  return { visible: shown, hide };
}
