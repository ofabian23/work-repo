import { describe, expect, it } from "vitest";
import { EmailDeliveryEventSchema } from "@/domain/email/email-delivery-event";
import { ConsentRecordSchema, ConsentRecordSetSchema } from "@/domain/leads/consent-record";
import { LeadCreatedResponseSchema, LeadSubmissionSchema } from "@/domain/leads/lead-submission";
import { ReportPayloadSchema } from "@/domain/report/report-payload";
import { IDEMPOTENCY_KEY, SESSION_ID, signals } from "../../helpers/fixtures";
import { expectInvalid, expectValid } from "../../helpers/schema";

const lead = () => ({
  sessionId: SESSION_ID,
  sessionStartedAt: "2026-10-20T13:58:00Z",
  idempotencyKey: IDEMPOTENCY_KEY,
  firstName: "María José",
  lastName: "O'Neill-Rivera",
  organization: "Hospital San Juan (Metro)",
  jobFunctionId: "procurement-supply",
  email: "  Maria.Rivera@Hospital.example ",
  phone: "+1 (787) 555-0100",
  preferredLanguage: "es",
  selectedInterestIds: ["supply-continuity", "monitoring-telemetry"],
  consents: { reportDelivery: true, salesFollowUp: false },
  consentVersion: "0.1.0",
  signals: signals(),
  submittedAt: "2026-10-20T14:03:00Z",
});

describe("LeadSubmissionSchema", () => {
  it("accepts a valid submission and normalizes the email", () => {
    const parsed = expectValid(LeadSubmissionSchema, lead());
    expect(parsed.email).toBe("maria.rivera@hospital.example");
  });
  it("accepts a submission without phone", () => {
    expectValid(LeadSubmissionSchema, { ...lead(), phone: null });
  });
  it("requires report-delivery consent", () => {
    expectInvalid(
      LeadSubmissionSchema,
      { ...lead(), consents: { reportDelivery: false, salesFollowUp: true } },
      "consents.reportDelivery",
      "Consent is required",
    );
  });
  it("keeps the two consents separate and both required as fields", () => {
    expectInvalid(
      LeadSubmissionSchema,
      { ...lead(), consents: { reportDelivery: true } },
      "consents.salesFollowUp",
    );
    expectInvalid(LeadSubmissionSchema, { ...lead(), consents: true }, "consents");
  });
  it.each(["not-an-email", "a@b", "@example.com"])("rejects invalid email %s", (email) => {
    expectInvalid(LeadSubmissionSchema, { ...lead(), email }, "email");
  });
  it.each(["123", "abc-defg-hij", "+1 787 555 0100 ext 99999999999"])("rejects invalid phone %s", (phone) => {
    expectInvalid(LeadSubmissionSchema, { ...lead(), phone }, "phone");
  });
  it("rejects empty or non-name characters in names", () => {
    expectInvalid(LeadSubmissionSchema, { ...lead(), firstName: "  " }, "firstName");
    expectInvalid(LeadSubmissionSchema, { ...lead(), lastName: "<script>" }, "lastName");
  });
  it("rejects internal or unexpected fields such as a lead score or free-text comments", () => {
    expectInvalid(LeadSubmissionSchema, { ...lead(), leadScore: 90 }, "", "Unrecognized");
    expectInvalid(LeadSubmissionSchema, { ...lead(), comments: "Patient in room 4" }, "", "Unrecognized");
  });
  it("rejects client-computed recommendations (the server recomputes)", () => {
    expectInvalid(LeadSubmissionSchema, { ...lead(), recommendations: [] }, "", "Unrecognized");
  });
  it("requires UUID session and idempotency keys", () => {
    expectInvalid(LeadSubmissionSchema, { ...lead(), sessionId: "123" }, "sessionId");
    expectInvalid(LeadSubmissionSchema, { ...lead(), idempotencyKey: "abc" }, "idempotencyKey");
  });

  it("requires a random (v4) request token, so the nil UUID cannot be used", () => {
    const nil = "00000000-0000-0000-0000-000000000000";
    expectInvalid(LeadSubmissionSchema, { ...lead(), idempotencyKey: nil }, "idempotencyKey");
  });

  it("rejects internationalized (non-ASCII) addresses", () => {
    expectInvalid(LeadSubmissionSchema, { ...lead(), email: "josé@hospital.example" }, "email");
  });
});

describe("LeadCreatedResponseSchema", () => {
  const statusToken = "A".repeat(43);
  it("returns only an opaque status token and flags (no lead id)", () => {
    expectValid(LeadCreatedResponseSchema, { statusToken, emailQueued: true, replayed: false });
    expectInvalid(
      LeadCreatedResponseSchema,
      { statusToken: "short", emailQueued: true, replayed: false },
      "statusToken",
    );
    expectInvalid(
      LeadCreatedResponseSchema,
      { statusToken, emailQueued: true, replayed: false, leadId: "lead_1" },
      "",
      "Unrecognized",
    );
  });
});

const consent = (consentType = "report-delivery", granted = true) => ({
  consentType,
  granted,
  consentVersion: "0.1.0",
  language: "es",
  textShown: "Autorizo el envío del informe.",
  recordedAt: "2026-10-20T14:03:00Z",
  source: "kiosk-lead-form",
});

describe("ConsentRecordSchema", () => {
  it("accepts granted and declined records", () => {
    expectValid(ConsentRecordSchema, consent());
    expectValid(ConsentRecordSchema, consent("sales-follow-up", false));
  });
  it("requires the exact text shown", () => {
    expectInvalid(ConsentRecordSchema, { ...consent(), textShown: "" }, "textShown");
  });
  it("rejects an unknown consent type", () => {
    expectInvalid(ConsentRecordSchema, { ...consent(), consentType: "marketing" }, "consentType");
  });
  it("requires exactly one record per consent type with a shared version", () => {
    expectValid(ConsentRecordSetSchema, [consent(), consent("sales-follow-up", false)]);
    expect(ConsentRecordSetSchema.safeParse([consent(), consent()]).success).toBe(false);
    expect(
      ConsentRecordSetSchema.safeParse([
        consent(),
        { ...consent("sales-follow-up"), consentVersion: "0.2.0" },
      ]).success,
    ).toBe(false);
  });
});

const report = () => ({
  leadId: "lead_1",
  language: "es",
  contentMode: "demo",
  contentVersion: "0.1.0",
  engineVersion: "1.0.0",
  generatedAt: "2026-10-20T14:03:01Z",
  visitor: { firstName: "María", lastName: "Rivera", organization: "Hospital San Juan" },
  role: { id: "procurement-supply", label: "Compras y cadena de suministro" },
  priorities: [{ id: "supply-continuity", label: "Mejorar la continuidad del suministro" }],
  areasExplored: [{ id: "gas-plant", title: "Planta de gases medicinales" }],
  recommendations: [
    {
      solutionId: "medical-gas-supply-planning",
      title: "Continuidad del suministro de gases medicinales",
      summary: "Opciones de suministro a granel y en cilindros.",
      reasons: ["Porque indicó como prioridad mejorar la continuidad del suministro."],
      relatedAreas: ["Planta de gases medicinales"],
      nextStep: "Revise con un especialista su perfil de consumo.",
      resources: [{ title: "Resumen", url: "https://www.example.org/resumen" }],
      pendingValidation: true,
    },
  ],
  callToAction: { heading: "Próximos pasos", body: "Un especialista puede ayudarle." },
  salesContact: null,
  disclaimer: "La aplicabilidad final requiere una consulta con un representante calificado.",
  pendingValidationNotice: "Parte del contenido está pendiente de validación para Puerto Rico.",
});

describe("ReportPayloadSchema", () => {
  it("accepts a demo report with a pending-validation notice", () => {
    expectValid(ReportPayloadSchema, report());
  });
  it("rejects a lead score or any internal field", () => {
    expectInvalid(ReportPayloadSchema, { ...report(), leadScore: 88 }, "", "Unrecognized");
    expectInvalid(
      ReportPayloadSchema,
      { ...report(), visitor: { ...report().visitor, leadTier: "A" } },
      "visitor",
      "Unrecognized",
    );
  });
  it("requires the notice when recommendations are pending validation", () => {
    expectInvalid(
      ReportPayloadSchema,
      { ...report(), pendingValidationNotice: null },
      "pendingValidationNotice",
    );
  });
  it("rejects pending content in a production report", () => {
    expectInvalid(
      ReportPayloadSchema,
      { ...report(), contentMode: "production" },
      "recommendations",
      "production",
    );
  });
  it("requires at least one recommendation with at least one reason", () => {
    expectInvalid(ReportPayloadSchema, { ...report(), recommendations: [] }, "recommendations");
    const noReasons = { ...report().recommendations[0]!, reasons: [] };
    expectInvalid(
      ReportPayloadSchema,
      { ...report(), recommendations: [noReasons] },
      "recommendations[0].reasons",
    );
  });
  it("only allows public https resource links", () => {
    const local = {
      ...report().recommendations[0]!,
      resources: [{ title: "PDF", url: "http://192.168.137.1:3000/a.pdf" }],
    };
    expectInvalid(
      ReportPayloadSchema,
      { ...report(), recommendations: [local] },
      "recommendations[0].resources[0].url",
    );
  });
  it("requires a disclaimer", () => {
    expectInvalid(ReportPayloadSchema, { ...report(), disclaimer: "" }, "disclaimer");
  });
});

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "evt_1",
  outboxId: "out_1",
  leadId: "lead_1",
  kind: "visitor-report",
  eventType: "queued",
  attempt: 0,
  provider: "smtp",
  occurredAt: "2026-10-20T14:03:01Z",
  providerMessageId: null,
  errorCode: null,
  errorMessage: null,
  retryable: null,
  nextAttemptAt: null,
  ...overrides,
});

describe("EmailDeliveryEventSchema", () => {
  it("accepts a normal lifecycle", () => {
    expectValid(EmailDeliveryEventSchema, event());
    expectValid(EmailDeliveryEventSchema, event({ eventType: "attempt-started", attempt: 1 }));
    expectValid(
      EmailDeliveryEventSchema,
      event({
        eventType: "attempt-failed",
        attempt: 1,
        errorCode: "SMTP_TIMEOUT",
        errorMessage: "Connection timed out",
        retryable: true,
      }),
    );
    expectValid(
      EmailDeliveryEventSchema,
      event({ eventType: "retry-scheduled", attempt: 1, nextAttemptAt: "2026-10-20T14:03:31Z" }),
    );
    expectValid(
      EmailDeliveryEventSchema,
      event({ eventType: "sent", attempt: 2, providerMessageId: "<abc@mail>" }),
    );
  });
  it("requires an error code on failures", () => {
    expectInvalid(
      EmailDeliveryEventSchema,
      event({ eventType: "attempt-failed", attempt: 1, retryable: true }),
      "errorCode",
    );
    expectInvalid(EmailDeliveryEventSchema, event({ eventType: "gave-up", attempt: 12 }), "errorCode");
  });
  it("requires a future nextAttemptAt when a retry is scheduled", () => {
    expectInvalid(
      EmailDeliveryEventSchema,
      event({ eventType: "retry-scheduled", attempt: 1 }),
      "nextAttemptAt",
    );
    expectInvalid(
      EmailDeliveryEventSchema,
      event({ eventType: "retry-scheduled", attempt: 1, nextAttemptAt: "2026-10-20T14:00:00Z" }),
      "nextAttemptAt",
      "after",
    );
  });
  it("rejects error messages containing email addresses", () => {
    expectInvalid(
      EmailDeliveryEventSchema,
      event({
        eventType: "attempt-failed",
        attempt: 1,
        errorCode: "SMTP_REJECTED",
        errorMessage: "550 maria@hospital.example rejected",
        retryable: false,
      }),
      "errorMessage",
      "email addresses",
    );
  });
  it("never stores recipients or bodies", () => {
    expectInvalid(EmailDeliveryEventSchema, event({ to: "maria@hospital.example" }), "", "Unrecognized");
  });
  it("enforces attempt numbering", () => {
    expectInvalid(EmailDeliveryEventSchema, event({ attempt: 1 }), "attempt");
    expectInvalid(
      EmailDeliveryEventSchema,
      event({ eventType: "sent", attempt: 0, providerMessageId: "x" }),
      "attempt",
    );
  });
  it("requires a provider message id when sent", () => {
    expectInvalid(EmailDeliveryEventSchema, event({ eventType: "sent", attempt: 1 }), "providerMessageId");
  });
});
