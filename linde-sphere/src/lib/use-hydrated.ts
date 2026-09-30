"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * False during server rendering and hydration, true once the component is interactive on the client.
 * Lets screens ignore or defer interactions that would otherwise be lost before hydration completes.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
