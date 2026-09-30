import { describe, expect, it, vi } from "vitest";
import { visibleContent } from "@/domain/content/visibility";
import { LeadSubmissionSchema } from "@/domain/leads/lead-submission";
import { maskEmailForDisplay } from "@/domain/leads/mask-email";
import { recommend } from "@/domain/recommendations/engine";
import { EMPTY_SIGNALS } from "@/domain/session/visitor-session";
import { awaitDelivery, createLeadApi, type LeadApi } from "@/features/kiosk/lead/lead-api";
import {
  buildSubmission,
  fieldErrorsFromServer,
  initialValues,
  interestOptions,
  MAX_FORM_INTERESTS,
  stepForErrors,
  validateField,
  validateFields,
  type LeadFormValues,
} from "@/features/kiosk/lead/lead-form-model";
import { INITIAL_KIOSK_STATE, kioskReducer } from "@/features/kiosk/state/kiosk-state";
import { loadSeedBundle } from "../../helpers/schema";

const content = visibleContent(loadSeedBundle(), "demo");
const signals = { ...EMPTY_SIGNALS, personaId: "procurement-supply", challengeIds: ["supply-continuity"] };

const values = (overrides: Partial<LeadFormValues> = {}): LeadFormValues => ({
  firstName: "María",
  lastName: "Rivera",
  organization: "Hospital San Juan",
  email: "maria@hospital.example",
  phone: "",
  roleId: "procurement-supply",
  language: "es",
  interestIds: ["supply-continuity"],
  reportConsent: true,
  followUpConsent: false,
  ...overrides,
});

describe("maskEmailForDisplay", () => {
  it.each([
    ["maria.rivera@hospital.example", "ma•••@hospital.example"],
    ["ana@clinic.example", "a•••@clinic.example"],
    ["x@y.example", "x•••@y.example"],
    ["not-an-email", "•••"],
  ])("%s → %s", (email, masked) => expect(maskEmailForDisplay(email)).toBe(masked));
});

describe("lead form model", () => {
  it("prefills role, language and interests from the session", () => {
    const result = recommend(signals, content);
    const interests = interestOptions(signals, result, content);
    expect(interests[0]).toMatchObject({ id: "supply-continuity", kind: "challenge" });
    expect(interests.filter((i) => i.kind === "solution").length).toBeGreaterThan(0);
    expect(interests.length).toBeLessThanOrEqual(MAX_FORM_INTERESTS);
    const initial = initialValues({ signals, language: "en", interests });
    expect(initial).toMatchObject({
      roleId: "procurement-supply",
      language: "en",
      reportConsent: false,
      followUpConsent: false,
    });
    expect(initial.interestIds).toEqual(interests.map((i) => i.id));
    expect(initial.firstName + initial.email).toBe("");
  });

  it("validates fields with the server's rules", () => {
    expect(validateField("email", values({ email: "" }))).toBe("required");
    expect(validateField("email", values({ email: "maria@" }))).toBe("invalid");
    expect(validateField("email", values({ email: " Maria@Hospital.Example " }))).toBeUndefined();
    expect(validateField("phone", values({ phone: "" }))).toBeUndefined();
    expect(validateField("phone", values({ phone: "123" }))).toBe("invalid");
    expect(validateField("firstName", values({ firstName: "<b>" }))).toBe("invalid");
    expect(validateField("reportConsent", values({ reportConsent: false }))).toBe("required");
    expect(validateFields(["roleId", "reportConsent"], values({ roleId: "", reportConsent: false }))).toEqual(
      {
        roleId: "required",
        reportConsent: "required",
      },
    );
  });

  it("builds a payload the server schema accepts, with no extra fields", () => {
    const payload = buildSubmission(values({ phone: " +1 787 555 0100 " }), {
      sessionId: "5b0c6a8e-7a53-4a5e-9f3d-2f4b8a6d9c11",
      sessionStartedAt: "2026-10-20T13:58:00Z",
      signals,
      idempotencyKey: "0f8e2f52-8f0c-4d8a-a1b2-3c4d5e6f7a8b",
      consentVersion: "0.1.0",
      submittedAt: "2026-10-20T14:03:00Z",
    });
    const parsed = LeadSubmissionSchema.parse(payload);
    expect(parsed.phone).toBe("+1 787 555 0100");
    expect(parsed.consents).toEqual({ reportDelivery: true, salesFollowUp: false });
    expect(buildSubmission(values({ phone: "  " }), { ...payload, signals }).phone).toBeNull();
  });

  it("maps server field errors onto the form and finds the step to show", () => {
    const errors = fieldErrorsFromServer([{ field: "jobFunctionId" }, { field: "signals.x" }]);
    expect(errors).toEqual({ roleId: "invalid" });
    expect(stepForErrors(errors)).toBe("preferences");
    expect(stepForErrors({ ...errors, email: "invalid" })).toBe("contact");
    expect(stepForErrors({})).toBeNull();
  });
});

describe("lead API client", () => {
  const payload = {} as never;
  const respond = (status: number, body: unknown) =>
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
    );

  it("maps responses to outcomes without exposing bodies", async () => {
    const token = "A".repeat(43);
    expect(
      await createLeadApi({
        fetchImpl: respond(201, { statusToken: token, emailQueued: true, replayed: false }),
      }).submit(payload),
    ).toEqual({ kind: "stored", statusToken: token });
    expect(
      await createLeadApi({
        fetchImpl: respond(200, { statusToken: token, emailQueued: true, replayed: true }),
      }).submit(payload),
    ).toEqual({ kind: "stored", statusToken: token });
    expect(
      await createLeadApi({
        fetchImpl: respond(422, {
          error: "validation_failed",
          issues: [{ field: "email", code: "x", message: "m" }],
        }),
      }).submit(payload),
    ).toEqual({ kind: "invalid", fields: [{ field: "email" }] });
    expect(await createLeadApi({ fetchImpl: respond(409, {}) }).submit(payload)).toEqual({
      kind: "conflict",
    });
    expect(
      await createLeadApi({ fetchImpl: respond(500, { error: "server_error" }) }).submit(payload),
    ).toEqual({ kind: "failed" });
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await createLeadApi({ fetchImpl: offline }).submit(payload)).toEqual({ kind: "failed" });
  });

  it("treats a request that takes too long as failed (safe to retry)", async () => {
    const hanging = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    expect(await createLeadApi({ fetchImpl: hanging, timeoutMs: 10 }).submit(payload)).toEqual({
      kind: "failed",
    });
  });

  it("reads the delivery state and polls until it is known", async () => {
    const api = createLeadApi({ fetchImpl: respond(200, { submission: "stored", report: "retrying" }) });
    expect(await api.status("A".repeat(43))).toBe("retrying");
    expect(await createLeadApi({ fetchImpl: respond(404, { error: "not_found" }) }).status("x")).toBeNull();

    const states = ["pending", "sent"] as const;
    const polling: LeadApi = { submit: vi.fn(), status: vi.fn(async () => states[Math.min(i++, 1)]!) };
    let i = 0;
    const sleep = vi.fn(async () => undefined);
    expect(await awaitDelivery(polling, "t", { attempts: 3, intervalMs: 5, sleep })).toBe("sent");
    expect(sleep).toHaveBeenCalledTimes(1);
    const pending: LeadApi = { submit: vi.fn(), status: vi.fn(async () => "pending" as const) };
    expect(await awaitDelivery(pending, "t", { attempts: 2, intervalMs: 0, sleep })).toBe("queued");
    const failed: LeadApi = { submit: vi.fn(), status: vi.fn(async () => "failed" as const) };
    expect(await awaitDelivery(failed, "t", { attempts: 3, intervalMs: 0, sleep })).toBe("delayed");
  });
});

describe("kiosk state — lead form actions", () => {
  const started = kioskReducer(INITIAL_KIOSK_STATE, {
    type: "START_SESSION",
    id: "00000000-0000-4000-8000-000000000001",
    startedAt: "2026-10-20T13:58:00Z",
  });

  it("opens, cancels and records submissions as anonymous events only", () => {
    const open = kioskReducer(started, { type: "OPEN_LEAD_FORM" });
    expect(open.screen).toBe("lead-form");
    const submitted = kioskReducer(open, { type: "LEAD_SUBMITTED" });
    expect(submitted.screen).toBe("lead-form");
    const cancelled = kioskReducer(open, { type: "CANCEL_LEAD_FORM" });
    expect(cancelled.screen).toBe("recommendations");
    expect(submitted.session!.events.map((e) => e.type).slice(-2)).toEqual([
      "lead-form-opened",
      "lead-submitted",
    ]);
    expect(submitted.session!.events.every((e) => e.targetId === null || !/@/.test(e.targetId))).toBe(true);
  });
});
