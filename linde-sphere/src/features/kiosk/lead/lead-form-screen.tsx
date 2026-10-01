"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PrimaryAction, SecondaryAction } from "@/components/actions/action-button";
import { LoadingState } from "@/components/feedback/loading-state";
import { StatusBanner } from "@/components/feedback/status-banner";
import { ArrowRightIcon } from "@/components/icons";
import { ProgressIndicator } from "@/components/navigation/progress-indicator";
import { Modal } from "@/components/overlay/dialog";
import type { LeadCaptureContent } from "@/domain/content/visibility";
import { maskEmailForDisplay } from "@/domain/leads/mask-email";
import type { RecommendationResult } from "@/domain/recommendations/recommendation-result";
import { useLanguage } from "@/lib/i18n/language-provider";
import { ScreenFrame } from "../journey/screen-frame";
import { CompletionScreen } from "./completion-screen";
import { createSessionId } from "../state/session-id";
import { appConfig } from "@/lib/config/app-config";
import { awaitDelivery, createLeadApi, type DeliveryOutcome, type LeadApi } from "./lead-api";
import {
  buildSubmission,
  CONTACT_FIELDS,
  fieldErrorsFromServer,
  initialValues,
  interestOptions,
  PREFERENCE_FIELDS,
  stepForErrors,
  validateField,
  validateFields,
  type FieldErrors,
  type LeadFormField,
  type LeadFormValues,
  type SessionContext,
} from "./lead-form-model";
import { CONTACT_FORM_ID, ContactStep, PreferencesStep, ReviewStep } from "./lead-form-steps";

type Step = "contact" | "preferences" | "review";
type Phase = Step | "sending" | "result";
type Failure = "failed" | "conflict" | "invalid" | null;
type Result = { delivery: DeliveryOutcome; maskedEmail: string; followUp: boolean };

const STEP_NUMBER: Record<Step, number> = { contact: 1, preferences: 2, review: 3 };

/**
 * Lead capture after the recommendations (ADR-053): contact details → preferences and consents → review
 * → sending → result. Contact values live only in this component's state: they are never written to the
 * kiosk session store, they are cleared once the lead is stored, and the component unmounts (and the page
 * hard-reloads) on every reset. The recommendation context stays in the session whatever happens here.
 */
export function LeadFormScreen({
  content,
  session,
  recommendations,
  api: injectedApi,
  statusPoll,
  confirmationResetMs,
  onSubmitted,
  onSubmissionStarted = () => undefined,
  onSubmissionFailed = () => undefined,
  onCompleted = () => undefined,
  onCancel,
  onFinish,
}: {
  content: LeadCaptureContent;
  session: SessionContext;
  recommendations: RecommendationResult | null;
  /** Injected in tests; defaults to the real /api/leads client. */
  api?: LeadApi;
  statusPoll: { attempts: number; intervalMs: number };
  confirmationResetMs: number;
  /** Records the anonymous "lead-submitted" event once the server has stored the lead. */
  onSubmitted: () => void;
  /** Session-state hooks (ADR-055): no reset may interrupt a submission between started and failed/completed. */
  onSubmissionStarted?: () => void;
  onSubmissionFailed?: () => void;
  onCompleted?: () => void;
  onCancel: () => void;
  /** Ends the visit (privacy reset). */
  onFinish: () => void;
}) {
  const { t, language, localize } = useLanguage();
  const api = useMemo(
    () => injectedApi ?? createLeadApi({ timeoutMs: appConfig.leadForm.requestTimeoutMs }),
    [injectedApi],
  );
  const interests = useMemo(
    () => interestOptions(session.signals, recommendations, content),
    // The options are fixed when the form opens, so the list does not shift while the visitor edits it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [values, setValues] = useState<LeadFormValues>(() =>
    initialValues({ signals: session.signals, language, interests }),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("contact");
  const [sendingStage, setSendingStage] = useState<"saving" | "preparing">("saving");
  const [failure, setFailure] = useState<Failure>(null);
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  // Double-tap protection: one request at a time, and one request token per distinct submission.
  const inFlight = useRef(false);
  const requestToken = useRef<string | null>(null);
  const lastAttempt = useRef<string | null>(null);
  // Set on every mount, not only cleared on unmount: React StrictMode (next dev) mounts, cleans up and
  // mounts again, and a flag left false would make the form ignore every submission result.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // After a failed "Continuar", move focus to the first field with an error.
  useEffect(() => {
    if (focusRequest === 0) return;
    document.querySelector<HTMLElement>('[data-testid="lead-form"] [aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const change = <K extends LeadFormField>(field: K, value: LeadFormValues[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // Once a field shows an error, re-check it while the visitor corrects it.
    if (errors[field]) setErrors((e) => ({ ...e, [field]: validateField(field, next) }));
  };
  const blur = (field: LeadFormField) => {
    // Inline validation after the visitor leaves a field they typed in (empty fields wait for "Continuar").
    const value = values[field];
    if (typeof value === "string" && value.trim() === "") return;
    setErrors((e) => ({ ...e, [field]: validateField(field, values) }));
  };

  const goTo = (step: Step) => {
    setShowErrorSummary(false);
    setPhase(step);
  };
  const checkStep = (fields: readonly LeadFormField[], next: Step) => {
    const stepErrors = validateFields(fields, values);
    setErrors((e) => ({ ...e, ...Object.fromEntries(fields.map((f) => [f, stepErrors[f]])) }));
    if (Object.keys(stepErrors).length > 0) {
      setShowErrorSummary(true);
      setFocusRequest((n) => n + 1);
      return;
    }
    goTo(next);
  };

  const hasTypedData = CONTACT_FIELDS.some((f) => values[f].trim() !== "");
  const requestCancel = () => (hasTypedData ? setCancelOpen(true) : onCancel());

  const submit = async () => {
    if (inFlight.current) return;
    const allErrors = validateFields([...CONTACT_FIELDS, ...PREFERENCE_FIELDS], values);
    const step = stepForErrors(allErrors);
    if (step) {
      setErrors(allErrors);
      setShowErrorSummary(true);
      setPhase(step);
      setFocusRequest((n) => n + 1);
      return;
    }
    inFlight.current = true;
    // A retry of the same data reuses the request token, so a request that was stored but whose answer
    // was lost is recognized as the same one; corrected data gets a new token.
    const snapshot = JSON.stringify(values);
    if (!requestToken.current || lastAttempt.current !== snapshot) requestToken.current = createSessionId();
    lastAttempt.current = snapshot;
    setFailure(null);
    setSendingStage("saving");
    setPhase("sending");
    onSubmissionStarted();

    const outcome = await api.submit(
      buildSubmission(values, {
        ...session,
        idempotencyKey: requestToken.current,
        consentVersion: content.consent.version,
        submittedAt: new Date().toISOString(),
      }),
    );
    if (!mounted.current) return;

    if (outcome.kind === "stored") {
      onSubmitted();
      setSendingStage("preparing");
      // Only an email follow-up has a delivery to wait for (ADR-062).
      const delivery =
        outcome.followUp === "package"
          ? "packaged"
          : await awaitDelivery(api, outcome.statusToken, statusPoll);
      if (!mounted.current) return;
      setResult({
        delivery,
        maskedEmail: maskEmailForDisplay(values.email.trim().toLowerCase()),
        followUp: values.followUpConsent,
      });
      // The contact details are no longer needed on this screen.
      setValues(initialValues({ signals: session.signals, language, interests }));
      setPhase("result");
      onCompleted();
    } else if (outcome.kind === "invalid") {
      onSubmissionFailed();
      const serverErrors = fieldErrorsFromServer(outcome.fields);
      setErrors(serverErrors);
      setFailure("invalid");
      setShowErrorSummary(true);
      setPhase(stepForErrors(serverErrors) ?? "review");
      setFocusRequest((n) => n + 1);
    } else {
      onSubmissionFailed();
      if (outcome.kind === "conflict") requestToken.current = null;
      setFailure(outcome.kind);
      setPhase("review");
    }
    inFlight.current = false;
  };

  const cancelButton = (
    <SecondaryAction size="md" data-testid="lead-cancel" onClick={requestCancel}>
      {t("leadForm.actions.cancel")}
    </SecondaryAction>
  );
  const errorSummary = showErrorSummary && Object.values(errors).some(Boolean) && (
    <StatusBanner tone="error" title={t("leadForm.errors.summary")} />
  );

  let body;
  if (phase === "sending") {
    body = (
      <div data-testid="lead-sending" className="flex flex-1 flex-col" aria-busy="true">
        <LoadingState label={t(`leadForm.sending.${sendingStage}`)} />
      </div>
    );
  } else if (phase === "result" && result) {
    const copy = content.report;
    body = (
      <CompletionScreen
        delivery={result.delivery}
        maskedEmail={result.maskedEmail}
        followUp={result.followUp}
        consultation={{
          heading: localize(copy.callToAction.heading),
          body: localize(copy.callToAction.body),
          contact: copy.salesContact
            ? {
                name: localize(copy.salesContact.name),
                email: copy.salesContact.email,
                phone: copy.salesContact.phone,
              }
            : null,
        }}
        seconds={Math.round(confirmationResetMs / 1000)}
        onFinish={onFinish}
      />
    );
  } else {
    const step = phase === "result" ? "review" : phase;
    const progress = <ProgressIndicator current={STEP_NUMBER[step]} total={3} />;
    const frame = {
      contact: {
        subtitle: t("leadForm.contactIntro"),
        content: (
          <ContactStep
            values={values}
            errors={errors}
            onChange={change}
            onBlur={blur}
            onSubmit={() => checkStep(CONTACT_FIELDS, "preferences")}
          />
        ),
        actions: (
          <div className="flex w-full flex-col gap-3">
            <PrimaryAction
              fullWidth
              type="submit"
              form={CONTACT_FORM_ID}
              data-testid="lead-continue"
              icon={<ArrowRightIcon />}
            >
              {t("leadForm.actions.continue")}
            </PrimaryAction>
            {cancelButton}
          </div>
        ),
      },
      preferences: {
        subtitle: t("leadForm.preferencesIntro"),
        content: (
          <PreferencesStep
            values={values}
            errors={errors}
            onChange={change}
            onBlur={blur}
            content={content}
            interests={interests}
          />
        ),
        actions: (
          <div className="flex w-full flex-col gap-3">
            <PrimaryAction
              fullWidth
              data-testid="lead-continue"
              icon={<ArrowRightIcon />}
              onClick={() => checkStep(PREFERENCE_FIELDS, "review")}
            >
              {t("leadForm.actions.continue")}
            </PrimaryAction>
            <div className="grid gap-3 sm:grid-cols-2">
              <SecondaryAction size="md" data-testid="lead-back" onClick={() => goTo("contact")}>
                {t("leadForm.actions.back")}
              </SecondaryAction>
              {cancelButton}
            </div>
          </div>
        ),
      },
      review: {
        subtitle: t("leadForm.reviewIntro"),
        content: (
          <>
            {failure && (
              <StatusBanner tone="error" title={t("leadForm.failure.title")}>
                <span data-testid="lead-failure" data-failure={failure}>
                  {failure === "failed"
                    ? t("leadForm.failure.body")
                    : failure === "conflict"
                      ? t("leadForm.failure.conflict")
                      : t("leadForm.failure.invalid")}
                </span>
              </StatusBanner>
            )}
            <ReviewStep values={values} content={content} interests={interests} />
          </>
        ),
        actions: (
          <div className="flex w-full flex-col gap-3">
            <PrimaryAction fullWidth data-testid="lead-submit" icon={<ArrowRightIcon />} onClick={submit}>
              {failure === "failed" ? t("leadForm.actions.retry") : t("leadForm.actions.submit")}
            </PrimaryAction>
            <div className="grid gap-3 sm:grid-cols-2">
              <SecondaryAction size="md" data-testid="lead-correct" onClick={() => goTo("contact")}>
                {t("leadForm.actions.correct")}
              </SecondaryAction>
              {cancelButton}
            </div>
          </div>
        ),
      },
    }[step];
    body = (
      <ScreenFrame
        key={step}
        testId={`lead-step-${step}`}
        title={t(`leadForm.steps.${step}`)}
        subtitle={frame.subtitle}
        progress={progress}
        actions={frame.actions}
      >
        {errorSummary}
        {frame.content}
      </ScreenFrame>
    );
  }

  return (
    <div data-testid="lead-form" data-phase={phase} className="flex flex-1 flex-col">
      {body}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t("leadForm.cancelDialog.title")}
        description={t("leadForm.cancelDialog.body")}
        testId="lead-cancel-dialog"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row-reverse">
            <PrimaryAction data-autofocus data-testid="lead-cancel-keep" onClick={() => setCancelOpen(false)}>
              {t("leadForm.cancelDialog.keep")}
            </PrimaryAction>
            <SecondaryAction
              data-testid="lead-cancel-confirm"
              onClick={() => {
                setCancelOpen(false);
                onCancel();
              }}
            >
              {t("leadForm.cancelDialog.confirm")}
            </SecondaryAction>
          </div>
        }
      />
    </div>
  );
}
