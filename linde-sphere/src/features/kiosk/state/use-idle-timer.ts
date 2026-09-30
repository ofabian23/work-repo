"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type IdleConfig = { warningAfterMs: number; countdownMs: number };

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"] as const;

/**
 * Inactivity timer for the privacy reset (ARCHITECTURE §5.4). After `warningAfterMs` without activity
 * it opens a countdown of `countdownMs`; when it reaches zero `onTimeout` fires.
 * While the warning is open, global activity is ignored: only its explicit actions (keepAlive / stop)
 * decide, so a tap on "Start over" is not swallowed by an automatic dismissal.
 */
export function useIdleTimer({
  enabled,
  warningAfterMs,
  countdownMs,
  onTimeout,
}: IdleConfig & { enabled: boolean; onTimeout: () => void }) {
  const [phase, setPhase] = useState({ warning: false, seconds: 0 });
  const timers = useRef<{ warn?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});
  const warningRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const clear = useCallback(() => {
    clearTimeout(timers.current.warn);
    clearInterval(timers.current.tick);
  }, []);

  const schedule = useCallback(() => {
    clear();
    timers.current.warn = setTimeout(() => {
      let remaining = Math.max(1, Math.ceil(countdownMs / 1000));
      warningRef.current = true;
      setPhase({ warning: true, seconds: remaining });
      timers.current.tick = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setPhase({ warning: true, seconds: remaining });
          return;
        }
        clear();
        warningRef.current = false;
        setPhase({ warning: false, seconds: 0 });
        onTimeoutRef.current();
      }, 1000);
    }, warningAfterMs);
  }, [clear, countdownMs, warningAfterMs]);

  useEffect(() => {
    if (!enabled) return;
    schedule();
    const onActivity = () => {
      if (!warningRef.current) schedule();
    };
    for (const event of ACTIVITY_EVENTS)
      window.addEventListener(event, onActivity, { capture: true, passive: true });
    return () => {
      clear();
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity, { capture: true });
    };
  }, [enabled, schedule, clear]);

  /** "Continue": close the warning and restart the idle period. */
  const keepAlive = useCallback(() => {
    warningRef.current = false;
    setPhase({ warning: false, seconds: 0 });
    schedule();
  }, [schedule]);

  /** Stop and hide everything (used right before an explicit reset). */
  const stop = useCallback(() => {
    clear();
    warningRef.current = false;
    setPhase({ warning: false, seconds: 0 });
  }, [clear]);

  return { warningOpen: enabled && phase.warning, secondsRemaining: phase.seconds, keepAlive, stop };
}
