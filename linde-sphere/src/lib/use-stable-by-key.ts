"use client";

import { useState } from "react";

/**
 * Returns `value`, but keeps returning the first value seen for a given `key` until the key changes.
 * Lets derived data (e.g. recommendations) ignore changes that do not alter what the key describes.
 * Uses React's "adjust state during render" pattern (no effect, no extra render cycle).
 */
export function useStableByKey<T>(value: T, key: string): T {
  const [stored, setStored] = useState({ key, value });
  if (stored.key !== key) {
    setStored({ key, value });
    return value;
  }
  return stored.value;
}
