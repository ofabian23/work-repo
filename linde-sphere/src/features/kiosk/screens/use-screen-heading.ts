"use client";

import { useEffect, useRef } from "react";

/** Moves focus to the new screen's heading when a screen mounts (keyboard and screen-reader users). */
export function useScreenHeading<T extends HTMLElement = HTMLHeadingElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    // preventScroll: the screen already starts at the top; scrolling to the heading would hide the header.
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
