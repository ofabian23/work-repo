"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/**
 * True when motion should be minimized: the operating-system setting, or the visitor's own choice in the
 * accessibility sheet (passed in, because it lives in the session). CSS handles most motion through
 * `motion-safe:`; components use this when they would otherwise render extra layers just to animate.
 */
export function useReducedMotion(visitorPreference = false): boolean {
  const system = useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false,
  );
  return visitorPreference || system;
}
