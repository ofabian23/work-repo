import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LeadSubmissionInput, ReportDeliveryState } from "@/domain/leads/lead-submission";
import { LeadSubmissionSchema } from "@/domain/leads/lead-submission";
import type { LeadApi, SubmitOutcome } from "@/features/kiosk/lead/lead-api";
import { renderKiosk, session, startSession } from "./kiosk-harness";

const TOKEN = "T".repeat(43);
const events = () => session().events.map((e: { type: string }) => e.type);
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

function fakeApi({
  submit = { kind: "stored", statusToken: TOKEN, followUp: "email" },
  status = "pending",
}: { submit?: SubmitOutcome | (() => Promise<SubmitOutcome>); status?: ReportDeliveryState | null } = {}) {
  const api = {
    submit: vi.fn(async (_payload: LeadSubmissionInput) =>
      typeof submit === "function" ? submit() : submit,
    ),
    status: vi.fn(async (_token: string) => status),
  };
  return api satisfies LeadApi;
}

/** Role journey (procurement + one challenge) → recommendations → summary → lead form. */
async function openLeadForm(api: LeadApi, extra: Parameters<typeof renderKiosk>[0] = {}) {
  const utils = renderKiosk({ tailoringMs: 10, leadApi: api, ...extra });
  startSession();
  fireEvent.click(screen.getByTestId("path-role"));
  fireEvent.click(screen.getByTestId("persona-procurement-supply"));
  fireEvent.click(screen.getByTestId("persona-continue"));
  fireEvent.click(screen.getByTestId("challenge-supply-continuity"));
  fireEvent.click(screen.getByTestId("role-challenges-continue"));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
  fireEvent.click(screen.getByTestId("next-view-recommendations"));
  fireEvent.click(screen.getByTestId("send-summary"));
  fireEvent.click(screen.getByTestId("summary-continue"));
  expect(screen.getByTestId("lead-step-contact")).toBeInTheDocument();
  return utils;
}

const type = (testId: string, value: string) => {
  const input = screen.getByTestId(testId);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

function fillContact({ email = "  Maria.Rivera@Hospital.example " } = {}) {
  type("lead-firstName", "María José");
  type("lead-lastName", "O'Neill-Rivera");
  type("lead-organization", "Hospital San Juan (Metro)");
  type("lead-email", email);
  type("lead-phone", "+1 787 555 0100");
}
const next = () => fireEvent.click(screen.getByTestId("lead-continue"));

/** Contact → preferences (report consent given) → review. */
function completeToReview({ followUp = false } = {}) {
  fillContact();
  next();
  fireEvent.click(screen.getByTestId("consent-report"));
  if (followUp) fireEvent.click(screen.getByTestId("consent-follow-up"));
  next();
  expect(screen.getByTestId("lead-step-review")).toBeInTheDocument();
}

const PERSONAL = ["María", "O'Neill", "maria.rivera", "Hospital San Juan", "555 0100"];

describe("lead form — valid submission", () => {
  it("prefills the session context, submits once and shows only the masked destination", async () => {
    const api = fakeApi({ status: "sent" });
    await openLeadForm(api);
    expect(events()).toContain("lead-form-opened");

    fillContact();
    next();
    // Role, language and interests come from the visit.
    expect(screen.getByTestId("lead-role")).toHaveValue("procurement-supply");
    expect(screen.getByTestId("lead-language-es")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("lead-interest-supply-continuity")).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByTestId("lead-interests")).getAllByRole("button").length).toBeGreaterThan(1);

    fireEvent.click(screen.getByTestId("consent-report"));
    next();
    const review = screen.getByTestId("lead-review");
    expect(within(review).getByTestId("review-name")).toHaveTextContent("María José O'Neill-Rivera");
    expect(within(review).getByTestId("review-email")).toHaveTextContent("maria.rivera@hospital.example");
    expect(within(review).getByTestId("review-role")).toHaveTextContent("Compras y cadena de suministro");
    expect(within(review).getByTestId("review-follow-up-consent")).toHaveTextContent("No");

    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();

    expect(api.submit).toHaveBeenCalledTimes(1);
    const payload = api.submit.mock.calls[0]![0];
    expect(LeadSubmissionSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({
      sessionId: session().id,
      firstName: "María José",
      jobFunctionId: "procurement-supply",
      email: "Maria.Rivera@Hospital.example",
      phone: "+1 787 555 0100",
      preferredLanguage: "es",
      consents: { reportDelivery: true, salesFollowUp: false },
      consentVersion: "0.1.0",
    });
    expect(payload.selectedInterestIds).toContain("supply-continuity");
    expect(api.status).toHaveBeenCalledWith(TOKEN);

    const result = screen.getByTestId("lead-result");
    expect(result).toHaveAttribute("data-delivery", "sent");
    expect(result).toHaveTextContent("Enviamos su resumen");
    expect(result).toHaveTextContent("ma•••@hospital.example");
    expect(document.body.textContent).not.toContain("maria.rivera@hospital.example");
    // Contact data never enters the kiosk session store.
    PERSONAL.forEach((v) => expect(JSON.stringify(session())).not.toContain(v));
    expect(events().at(-1)).toBe("lead-submitted");
  });

  it("uses touch-friendly keyboards and keeps autofill off", async () => {
    await openLeadForm(fakeApi());
    const email = screen.getByLabelText(/Correo electrónico de trabajo/);
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("inputmode", "email");
    expect(email).toHaveAttribute("autocapitalize", "none");
    const phone = screen.getByLabelText(/Teléfono/);
    expect(phone).toHaveAttribute("type", "tel");
    expect(phone).toHaveAttribute("inputmode", "tel");
    expect(screen.getByLabelText(/^Nombre/)).toHaveAttribute("autocapitalize", "words");
    for (const input of screen.getAllByRole("textbox")) expect(input).toHaveAttribute("autocomplete", "off");
    expect(screen.getByTestId("progress")).toHaveTextContent("Paso 1 de 3");
  });

  it("moves forward with the keyboard's Enter key (typing flow)", async () => {
    await openLeadForm(fakeApi());
    const user = userEvent.setup();
    await user.type(screen.getByTestId("lead-firstName"), "Ana");
    await user.type(screen.getByTestId("lead-lastName"), "López");
    await user.type(screen.getByTestId("lead-organization"), "Clínica Norte");
    await user.type(screen.getByTestId("lead-email"), "ana@clinica.example{Enter}");
    // Enter moves to the next field ("next" key on the on-screen keyboard)…
    expect(document.activeElement).toBe(screen.getByTestId("lead-phone"));
    // …and on the last field it continues to the next step.
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("lead-step-preferences")).toBeInTheDocument();
  });
});

describe("lead form — follow-up mode (ADR-062)", () => {
  it("LOCAL_PACKAGE: no email promise, no delivery polling, and a prepared-package confirmation", async () => {
    const api = fakeApi({
      submit: { kind: "stored", statusToken: TOKEN, followUp: "package" },
      status: "sent",
    });
    renderKiosk({ tailoringMs: 10, leadApi: api });
    startSession();
    fireEvent.click(screen.getByTestId("path-role"));
    fireEvent.click(screen.getByTestId("persona-procurement-supply"));
    fireEvent.click(screen.getByTestId("persona-continue"));
    fireEvent.click(screen.getByTestId("challenge-supply-continuity"));
    fireEvent.click(screen.getByTestId("role-challenges-continue"));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    fireEvent.click(screen.getByTestId("next-view-recommendations"));
    fireEvent.click(screen.getByTestId("send-summary"));
    // The default kiosk follow-up is the local package: the summary screen does not promise an email.
    expect(screen.getByTestId("summary-request-screen")).toHaveTextContent("Prepararemos un resumen");
    expect(screen.getByTestId("summary-request-screen")).not.toHaveTextContent(/Le enviaremos/);
    fireEvent.click(screen.getByTestId("summary-continue"));
    expect(screen.getByText("Lo usaremos para darle seguimiento con su resumen.")).toBeInTheDocument();
    completeToReview({ followUp: true });
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();

    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(api.status).not.toHaveBeenCalled();
    const result = screen.getByTestId("lead-result");
    expect(result).toHaveAttribute("data-delivery", "packaged");
    expect(result).toHaveTextContent("Su paquete personalizado de seguimiento está preparado");
    expect(screen.getByTestId("delivery-status")).toHaveTextContent(
      "Un representante de Linde podrá darle seguimiento con la información que compartió (ma•••@hospital.example).",
    );
    expect(result).not.toHaveTextContent(/Enviamos|enviamos|enviaremos/);
    expect(events().at(-1)).toBe("lead-submitted");
  });

  it("an email mode keeps the email wording on the summary screen", async () => {
    await openLeadForm(fakeApi(), { followUp: "email" });
    expect(screen.getByText("Aquí le enviaremos su resumen.")).toBeInTheDocument();
  });

  it("the server's answer decides: a package answer shows the package confirmation even in email copy mode", async () => {
    const api = fakeApi({ submit: { kind: "stored", statusToken: TOKEN, followUp: "package" } });
    await openLeadForm(api, { followUp: "email" });
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(api.status).not.toHaveBeenCalled();
    expect(screen.getByTestId("lead-result")).toHaveAttribute("data-delivery", "packaged");
  });
});

describe("lead form — React StrictMode (next dev)", () => {
  // Regression: under StrictMode effects mount, clean up and mount again. The form used to mark itself
  // unmounted in that cleanup and then ignore every submission result, staying on "Guardando su solicitud…"
  // forever in development, whether the lead was stored or the server failed.
  it("shows the confirmation after a stored submission", async () => {
    const api = fakeApi({ submit: { kind: "stored", statusToken: TOKEN, followUp: "package" } });
    await openLeadForm(api, { strict: true });
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("lead-sending")).toBeNull();
    expect(screen.getByTestId("lead-result")).toHaveAttribute("data-delivery", "packaged");
  });

  it("shows the failure message and keeps the details when the server fails", async () => {
    const api = fakeApi({ submit: { kind: "failed" } });
    await openLeadForm(api, { strict: true });
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(screen.queryByTestId("lead-sending")).toBeNull();
    expect(screen.getByTestId("lead-failure")).toHaveTextContent("Sus datos siguen aquí");
    expect(screen.getByTestId("review-email")).toHaveTextContent("maria.rivera@hospital.example");
  });
});

describe("lead form — validation", () => {
  it("shows an inline error for an invalid email and clears it as the visitor corrects it", async () => {
    await openLeadForm(fakeApi());
    type("lead-email", "maria@hospital");
    const email = screen.getByTestId("lead-email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Revise el correo. Debe tener la forma nombre@organizacion.com."),
    ).toBeInTheDocument();

    fireEvent.change(email, { target: { value: "maria@hospital.example" } });
    expect(email).not.toHaveAttribute("aria-invalid");
  });

  it("blocks each step until required fields are complete and says which ones", async () => {
    await openLeadForm(fakeApi());
    next();
    expect(screen.getByTestId("lead-step-contact")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Revise los campos marcados.");
    for (const field of ["firstName", "lastName", "organization", "email"]) {
      expect(screen.getByTestId(`lead-${field}`)).toHaveAttribute("aria-invalid", "true");
    }
    expect(screen.getByTestId("lead-phone")).not.toHaveAttribute("aria-invalid"); // optional
    expect(document.activeElement).toBe(screen.getByTestId("lead-firstName"));

    fillContact();
    next();
    next(); // no report consent yet
    expect(screen.getByTestId("lead-step-preferences")).toBeInTheDocument();
    expect(screen.getByText("Para preparar su resumen necesitamos su permiso.")).toBeInTheDocument();
  });

  it("asks for the role when the visit did not include one", async () => {
    renderKiosk({ tailoringMs: 10, leadApi: fakeApi() });
    startSession();
    fireEvent.click(screen.getByTestId("path-challenge"));
    fireEvent.click(screen.getByTestId("challenge-supply-continuity"));
    fireEvent.click(screen.getByTestId("challenges-continue"));
    fireEvent.click(screen.getByTestId("persona-continue")); // "Continuar sin elegir"
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    fireEvent.click(screen.getByTestId("send-summary"));
    fireEvent.click(screen.getByTestId("summary-continue"));
    fillContact();
    next();
    expect(screen.getByTestId("lead-role")).toHaveValue("");
    fireEvent.click(screen.getByTestId("consent-report"));
    next();
    expect(screen.getByText("Elija su área o función.")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("lead-role"), { target: { value: "finance" } });
    next();
    expect(screen.getByTestId("lead-step-review")).toBeInTheDocument();
  });

  it("puts server validation errors back on the right field", async () => {
    const api = fakeApi({ submit: { kind: "invalid", fields: [{ field: "email" }] } });
    await openLeadForm(api);
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(screen.getByTestId("lead-step-contact")).toBeInTheDocument();
    expect(screen.getByTestId("lead-email")).toHaveAttribute("aria-invalid", "true");
    expect((screen.getByTestId("lead-email") as HTMLInputElement).value.trim()).toBe(
      "Maria.Rivera@Hospital.example",
    );
  });
});

describe("lead form — separate consents", () => {
  it("keeps the two permissions independent, unchecked by default, with the configured text and version", async () => {
    const api = fakeApi();
    await openLeadForm(api);
    fillContact();
    next();
    const report = screen.getByTestId("consent-report");
    const followUp = screen.getByTestId("consent-follow-up");
    expect(report).not.toBeChecked();
    expect(followUp).not.toBeChecked();
    const consents = screen.getByTestId("lead-consents");
    expect(consents).toHaveTextContent("[BORRADOR] Autorizo el envío del informe personalizado");
    expect(consents).toHaveTextContent("[BORRADOR] Deseo que un representante me contacte");
    expect(screen.getByTestId("consent-version")).toHaveTextContent(
      "Versión del texto de consentimiento: 0.1.0",
    );
    expect(consents).toHaveTextContent("Texto provisional pendiente de revisión legal y de privacidad.");

    // Follow-up alone does not satisfy the report permission…
    fireEvent.click(followUp);
    expect(followUp).toBeChecked();
    expect(report).not.toBeChecked();
    next();
    expect(screen.getByTestId("lead-step-preferences")).toBeInTheDocument();
    // …and the report permission alone is enough.
    fireEvent.click(followUp);
    fireEvent.click(report);
    expect(followUp).not.toBeChecked();
    next();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(api.submit.mock.calls[0]![0].consents).toEqual({ reportDelivery: true, salesFollowUp: false });
    expect(screen.getByTestId("lead-result")).toHaveTextContent(
      "Solo usaremos sus datos para el resumen que solicitó.",
    );
  });

  it("sends the follow-up permission only when it was given", async () => {
    const api = fakeApi();
    await openLeadForm(api);
    completeToReview({ followUp: true });
    expect(screen.getByTestId("review-follow-up-consent")).toHaveTextContent("Sí, autorizado");
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(api.submit.mock.calls[0]![0].consents).toEqual({ reportDelivery: true, salesFollowUp: true });
  });
});

describe("lead form — double submission and failures", () => {
  it("sends one request for a double tap and shows progress while sending", async () => {
    let resolve!: (o: SubmitOutcome) => void;
    const api = fakeApi({ submit: () => new Promise<SubmitOutcome>((r) => (resolve = r)) });
    await openLeadForm(api);
    completeToReview();
    const submit = screen.getByTestId("lead-submit");
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(screen.getByTestId("lead-sending")).toHaveTextContent("Guardando su solicitud…");
    expect(screen.queryByTestId("lead-submit")).toBeNull();
    await act(async () => resolve({ kind: "stored", statusToken: TOKEN, followUp: "email" }));
    await flush();
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("lead-result")).toBeInTheDocument();
  });

  it("keeps the details and recommendations after a server error and retries with the same request token", async () => {
    const outcomes: SubmitOutcome[] = [
      { kind: "failed" },
      { kind: "stored", statusToken: TOKEN, followUp: "email" },
    ];
    const api = fakeApi({ submit: async () => outcomes.shift()! });
    await openLeadForm(api);
    const recommendations = session().recommendations;
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();

    expect(screen.getByTestId("lead-step-review")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos guardar su solicitud");
    expect(screen.getByTestId("lead-failure")).toHaveTextContent("Sus datos siguen aquí");
    expect(screen.getByTestId("review-email")).toHaveTextContent("maria.rivera@hospital.example");
    expect(session().recommendations).toEqual(recommendations);
    expect(document.body.textContent).not.toMatch(/500|error code|server_error/i);

    fireEvent.click(screen.getByTestId("lead-submit")); // "Intentar de nuevo"
    await flush();
    const [first, second] = api.submit.mock.calls.map((c) => c[0]);
    expect(second!.idempotencyKey).toBe(first!.idempotencyKey);
    expect(screen.getByTestId("lead-result")).toBeInTheDocument();
  });

  it("uses a new request token when the visitor corrects their details after a failure", async () => {
    const api = fakeApi({ submit: { kind: "failed" } });
    await openLeadForm(api);
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    fireEvent.click(screen.getByTestId("lead-correct"));
    type("lead-email", "otra@hospital.example");
    next();
    next();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    const [first, second] = api.submit.mock.calls.map((c) => c[0]);
    expect(second!.idempotencyKey).not.toBe(first!.idempotencyKey);
  });

  it("explains, without technical details, that the request was saved when the email could not be sent", async () => {
    const api = fakeApi({ status: "failed" });
    await openLeadForm(api);
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    const result = screen.getByTestId("lead-result");
    expect(result).toHaveAttribute("data-delivery", "delayed");
    expect(result).toHaveTextContent("Guardamos su solicitud");
    expect(result).toHaveTextContent("Lo intentaremos de nuevo automáticamente");
    expect(result).toHaveTextContent("ma•••@hospital.example");
    expect(result.textContent).not.toMatch(/SMTP|error|failed|código/i);
    expect(events()).toContain("lead-submitted");
  });

  it("says the request is saved when delivery has not happened yet", async () => {
    await openLeadForm(fakeApi({ status: "pending" }));
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(screen.getByTestId("lead-result")).toHaveTextContent(
      "Le enviaremos su resumen a ma•••@hospital.example",
    );
  });
});

describe("lead form — cancel, correct and reset", () => {
  it("“Corregir mis datos” returns to the details with everything kept", async () => {
    await openLeadForm(fakeApi());
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-correct"));
    expect(screen.getByTestId("lead-firstName")).toHaveValue("María José");
    next();
    expect(screen.getByTestId("consent-report")).toBeChecked();
  });

  it("cancel asks first, erases the typed details and keeps the recommendations", async () => {
    await openLeadForm(fakeApi());
    const recommendations = session().recommendations;
    fillContact();
    fireEvent.click(screen.getByTestId("lead-cancel"));
    fireEvent.click(screen.getByTestId("lead-cancel-keep"));
    expect(screen.getByTestId("lead-firstName")).toHaveValue("María José");
    fireEvent.click(screen.getByTestId("lead-cancel"));
    fireEvent.click(screen.getByTestId("lead-cancel-confirm"));

    expect(screen.getByTestId("recommendations-screen")).toBeInTheDocument();
    expect(session().recommendations).toEqual(recommendations);
    expect(events()).toContain("lead-form-cancelled");
    fireEvent.click(screen.getByTestId("send-summary"));
    fireEvent.click(screen.getByTestId("summary-continue"));
    expect(screen.getByTestId("lead-firstName")).toHaveValue("");
  });

  it("“Terminar” resets the visit and no contact data remains on screen", async () => {
    const { onHardReset } = await openLeadForm(fakeApi());
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    fireEvent.click(screen.getByTestId("lead-finish"));
    expect(onHardReset).toHaveBeenCalledWith("completed");
    expect(screen.getByTestId("attract-screen")).toBeInTheDocument();
    expect(session()).toBeNull();
    PERSONAL.forEach((v) => expect(document.body.textContent).not.toContain(v));
    expect(document.body.textContent).not.toContain("ma•••@hospital.example");
  });

  it("resets automatically after the confirmation", async () => {
    const { onHardReset } = await openLeadForm(fakeApi(), { confirmationResetMs: 1_000 });
    completeToReview();
    fireEvent.click(screen.getByTestId("lead-submit"));
    await flush();
    expect(screen.getByTestId("completion-countdown")).toHaveTextContent("Volveremos al inicio en 1 s.");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 1_100)));
    expect(onHardReset).toHaveBeenCalledWith("completed");
    expect(screen.queryByTestId("lead-result")).toBeNull();
  });

  it("an explicit reset in the middle of the form clears everything typed", async () => {
    const { onHardReset } = await openLeadForm(fakeApi());
    fillContact();
    fireEvent.click(screen.getByTestId("reset-experience"));
    fireEvent.click(
      within(screen.getByTestId("reset-confirmation")).getByRole("button", { name: "Sí, empezar de nuevo" }),
    );
    expect(onHardReset).toHaveBeenCalledWith("explicit");
    PERSONAL.forEach((v) => expect(document.body.textContent).not.toContain(v));
    startSession();
    expect(screen.queryByTestId("lead-form")).toBeNull();
  });
});
