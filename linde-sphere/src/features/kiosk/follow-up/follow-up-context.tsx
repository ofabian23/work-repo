"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { VisitorFollowUp } from "@/domain/follow-up/follow-up-mode";

/**
 * How the visitor's summary is followed up (ADR-062), so the kiosk copy never promises an email the
 * configured FOLLOW_UP_MODE will not send. "package" (LOCAL_PACKAGE, the default) or "email".
 */
const FollowUpContext = createContext<VisitorFollowUp>("package");

export function FollowUpProvider({ value, children }: { value: VisitorFollowUp; children: ReactNode }) {
  return <FollowUpContext value={value}>{children}</FollowUpContext>;
}

export const useVisitorFollowUp = (): VisitorFollowUp => useContext(FollowUpContext);
