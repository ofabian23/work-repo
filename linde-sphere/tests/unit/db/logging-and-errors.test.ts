import { describe, expect, it } from "vitest";
import { sanitizeEmailError } from "@/server/leads/email-error";
import { toCsv } from "@/server/leads/lead-export";
import { createLogger, maskEmail, maskFields, maskName, maskPhone } from "@/server/logging/logger";

describe("masked logger", () => {
  it("masks personal fields", () => {
    expect(maskEmail("maria.rivera@hospital.example")).toBe("m***@hospital.example");
    expect(maskName("maría")).toBe("M.");
    expect(maskPhone("+1 (787) 555-0142")).toBe("***42");
  });

  it("masks known keys recursively and email addresses inside any string", () => {
    const masked = maskFields({
      leadId: "lead-1",
      businessEmail: "maria@hospital.example",
      first_name: "María",
      nested: {
        phone: "787-555-0100",
        organization: "Hospital San Juan",
        note: "reply to ana@clinic.example",
      },
      list: [{ lastName: "Rivera" }],
      statusToken: "secret-token",
    });
    expect(masked).toEqual({
      leadId: "lead-1",
      businessEmail: "m***@hospital.example",
      first_name: "M.",
      nested: { phone: "***00", organization: "[redacted]", note: "reply to a***@clinic.example" },
      list: [{ lastName: "R." }],
      statusToken: "[redacted]",
    });
  });

  it("never logs a full contact record, even when one is passed by mistake", () => {
    const lines: string[] = [];
    const logger = createLogger({ sink: (_l, line) => lines.push(line), minLevel: "debug" });
    const record = {
      firstName: "María",
      lastName: "Rivera",
      organization: "Hospital San Juan",
      businessEmail: "maria.rivera@hospital.example",
      optionalPhone: "+1 787 555 0100",
    };
    logger.info("oops", { lead: record });
    logger.error("error", {
      error: Object.assign(new Error("failed for maria.rivera@hospital.example"), { code: "E1" }),
    });
    const text = lines.join("\n");
    for (const value of ["María", "Rivera", "Hospital San Juan", "maria.rivera@", "555 0100"]) {
      expect(text).not.toContain(value);
    }
    expect(JSON.parse(lines[0]!)).toMatchObject({ level: "info", event: "oops" });
  });

  it("respects the minimum level", () => {
    const lines: string[] = [];
    const logger = createLogger({ sink: (_l, line) => lines.push(line), minLevel: "warn" });
    logger.info("hidden");
    logger.warn("shown");
    expect(lines).toHaveLength(1);
  });
});

describe("sanitizeEmailError", () => {
  it.each([
    [
      { code: "ETIMEDOUT", message: "timeout talking to smtp.example" },
      { code: "NETWORK_TIMEOUT", retryable: true },
    ],
    [
      { code: "EAUTH", response: "535 auth failed for user x password y" },
      { code: "PROVIDER_AUTH_FAILED", retryable: false },
    ],
    [{ code: "EENVELOPE" }, { code: "RECIPIENT_REJECTED", retryable: false }],
    [{ responseCode: 421 }, { code: "SMTP_TRANSIENT_FAILURE", retryable: true }],
    [
      { responseCode: 550, response: "550 maria@hospital.example unknown" },
      { code: "SMTP_PERMANENT_FAILURE", retryable: false },
    ],
    [new Error("anything"), { code: "UNKNOWN_ERROR", retryable: true }],
    [undefined, { code: "UNKNOWN_ERROR", retryable: true }],
  ])("maps %j to a code without the provider text", (error, expected) => {
    const result = sanitizeEmailError(error);
    expect(result).toEqual(expected);
    expect(result.code).toMatch(/^[A-Z0-9_]{2,40}$/);
  });
});

describe("CSV export formatting", () => {
  it("quotes values and neutralizes spreadsheet formulas", () => {
    const csv = toCsv(["a", "b", "c"], [['=HYPERLINK("x")', "Hospital, Metro", "+1 787"]]);
    expect(csv).toBe(`a,b,c\r\n"'=HYPERLINK(""x"")","Hospital, Metro",'+1 787\r\n`);
  });
});
