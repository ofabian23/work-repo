import { describe, expect, it } from "vitest";
import {
  CONFIGURABLE_FOLLOW_UP_MODES,
  DEFAULT_FOLLOW_UP_MODE,
  FOLLOW_UP_MODES,
  IMPLEMENTED_FOLLOW_UP_MODES,
  usesEmailOutbox,
  visitorFollowUp,
} from "@/domain/follow-up/follow-up-mode";
import { GraphProvider } from "@/server/email/graph-provider";
import {
  createOutlookDraftProvider,
  FollowUpModeNotImplementedError,
} from "@/server/follow-up/outlook-draft";

describe("follow-up modes (ADR-062)", () => {
  it("defaults to LOCAL_PACKAGE, which never uses the email outbox", () => {
    expect(DEFAULT_FOLLOW_UP_MODE).toBe("LOCAL_PACKAGE");
    expect(usesEmailOutbox("LOCAL_PACKAGE")).toBe(false);
    expect(visitorFollowUp("LOCAL_PACKAGE")).toBe("package");
  });

  it("keeps every mode of the enum, with only the email modes routed to the outbox", () => {
    expect(FOLLOW_UP_MODES).toEqual([
      "LOCAL_PACKAGE",
      "SMTP_EMAIL",
      "MICROSOFT_GRAPH",
      "OUTLOOK_DRAFT",
      "FUTURE_CRM",
    ]);
    expect(CONFIGURABLE_FOLLOW_UP_MODES).not.toContain("FUTURE_CRM");
    expect(IMPLEMENTED_FOLLOW_UP_MODES).toEqual(["LOCAL_PACKAGE", "SMTP_EMAIL"]);
    expect(FOLLOW_UP_MODES.filter(usesEmailOutbox)).toEqual(["SMTP_EMAIL", "MICROSOFT_GRAPH"]);
    expect(visitorFollowUp("SMTP_EMAIL")).toBe("email");
    // A draft for a representative is not an automatic email: the visitor is told about a package.
    expect(visitorFollowUp("OUTLOOK_DRAFT")).toBe("package");
  });

  it("keeps the placeholders honest: they refuse to act instead of pretending to deliver", async () => {
    expect(() => createOutlookDraftProvider()).toThrow(FollowUpModeNotImplementedError);
    await expect(new GraphProvider().send()).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
  });
});
