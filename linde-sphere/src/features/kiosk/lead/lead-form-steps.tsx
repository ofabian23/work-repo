"use client";

import type { ReactNode } from "react";
import { ConsentCheckbox } from "@/components/forms/consent-checkbox";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { StatusBanner } from "@/components/feedback/status-banner";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import type { Language } from "@/domain/content/primitives";
import type { LeadCaptureContent } from "@/domain/content/visibility";
import { cn } from "@/lib/cn";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { FieldErrors, InterestOption, LeadFormField, LeadFormValues } from "./lead-form-model";

/** Presentational steps of the lead form (ADR-053). State and submission live in LeadFormScreen. */

type StepProps = {
  values: LeadFormValues;
  errors: FieldErrors;
  onChange: <K extends LeadFormField>(field: K, value: LeadFormValues[K]) => void;
  onBlur: (field: LeadFormField) => void;
};

function useErrorText() {
  const { t } = useLanguage();
  return (field: LeadFormField, errors: FieldErrors) => {
    const kind = errors[field];
    if (!kind) return undefined;
    switch (field) {
      case "firstName":
      case "lastName":
      case "organization":
      case "email":
      case "phone":
      case "roleId":
      case "reportConsent":
        return t(`leadForm.errors.${field}.${kind}`);
      default:
        return undefined;
    }
  };
}

export const CONTACT_FORM_ID = "lead-contact-form";

/**
 * Step 1 — contact details. Five inputs only, so the on-screen keyboard leaves them visible. Each input
 * has the keyboard that fits it (email, phone), words are capitalized where it helps, autofill and
 * spell-check are off on the shared kiosk, and Enter ("next" on the on-screen keyboard) moves to the
 * following field, then on to the next step.
 */
export function ContactStep({
  values,
  errors,
  onChange,
  onBlur,
  onSubmit,
}: StepProps & { onSubmit: () => void }) {
  const { t } = useLanguage();
  const errorText = useErrorText();
  const text = (field: "firstName" | "lastName" | "organization" | "email" | "phone") => ({
    value: values[field],
    error: errorText(field, errors),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(field, e.target.value),
    onBlur: () => onBlur(field),
    "data-testid": `lead-${field}`,
    name: `lead-${field}`,
  });
  return (
    <form
      id={CONTACT_FORM_ID}
      noValidate
      className="grid gap-6 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      onKeyDown={(e) => {
        // The keyboard's "next" key moves to the following field; on the last field it continues.
        if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement)) return;
        e.preventDefault();
        const inputs = [...e.currentTarget.querySelectorAll("input")];
        const following = inputs[inputs.indexOf(e.target) + 1];
        if (following) following.focus();
        else onSubmit();
      }}
    >
      <FormField
        {...text("firstName")}
        required
        label={t("leadForm.fields.firstName")}
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={80}
      />
      <FormField
        {...text("lastName")}
        required
        label={t("leadForm.fields.lastName")}
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={80}
      />
      <FormField
        {...text("organization")}
        required
        className="sm:col-span-2"
        label={t("leadForm.fields.organization")}
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={160}
      />
      <FormField
        {...text("email")}
        required
        className="sm:col-span-2"
        type="email"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="next"
        maxLength={254}
        label={t("leadForm.fields.email")}
        hint={t("leadForm.fields.emailHint")}
      />
      <FormField
        {...text("phone")}
        className="sm:col-span-2"
        type="tel"
        inputMode="tel"
        enterKeyHint="done"
        maxLength={25}
        label={t("leadForm.fields.phone")}
        hint={t("leadForm.fields.phoneHint")}
      />
    </form>
  );
}

function ToggleChip({
  pressed,
  onToggle,
  children,
  testId,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onToggle}
      className={cn(
        "focus-ring text-body min-h-touch-min flex items-center gap-2 rounded-full border-2 px-5 py-2 text-left font-medium",
        pressed ? "border-primary bg-primary/10 text-ink" : "border-line bg-surface text-ink-muted",
      )}
    >
      <CheckIcon size="size-5" className={pressed ? "text-primary" : "text-transparent"} />
      {children}
    </button>
  );
}

/**
 * Step 2 — what we already know from the visit (role, report language, interests), then the two
 * separate consents. Consent wording and its version come from content/consent.json.
 */
export function PreferencesStep({
  values,
  errors,
  onChange,
  content,
  interests,
}: StepProps & { content: LeadCaptureContent; interests: InterestOption[] }) {
  const { t, localize } = useLanguage();
  const errorText = useErrorText();
  const personas = [...content.personas].sort((a, b) => a.sortOrder - b.sortOrder);
  const consent = content.consent;
  const toggleInterest = (id: string) =>
    onChange(
      "interestIds",
      values.interestIds.includes(id)
        ? values.interestIds.filter((x) => x !== id)
        : [...values.interestIds, id],
    );
  const languages: Language[] = ["es", "en"];

  return (
    <div className="flex flex-col gap-8">
      <SelectField
        data-testid="lead-role"
        label={t("leadForm.fields.role")}
        placeholder={t("leadForm.fields.rolePlaceholder")}
        value={values.roleId}
        error={errorText("roleId", errors)}
        onChange={(e) => onChange("roleId", e.target.value)}
        options={personas.map((p) => ({ value: p.id, label: localize(p.label) }))}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-label text-ink mb-2 font-semibold">{t("leadForm.fields.language")}</legend>
        <div className="flex flex-wrap gap-3">
          {languages.map((language) => (
            <ToggleChip
              key={language}
              testId={`lead-language-${language}`}
              pressed={values.language === language}
              onToggle={() => onChange("language", language)}
            >
              {t(`language.${language}`)}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3" data-testid="lead-interests">
        <legend className="text-label text-ink mb-1 font-semibold">{t("leadForm.fields.interests")}</legend>
        {interests.length > 0 ? (
          <>
            <p className="text-caption text-ink-muted">{t("leadForm.fields.interestsHint")}</p>
            <div className="flex flex-wrap gap-3">
              {interests.map((interest) => (
                <ToggleChip
                  key={interest.id}
                  testId={`lead-interest-${interest.id}`}
                  pressed={values.interestIds.includes(interest.id)}
                  onToggle={() => toggleInterest(interest.id)}
                >
                  {localize(interest.label)}
                </ToggleChip>
              ))}
            </div>
          </>
        ) : (
          <p className="text-body text-ink-muted">{t("leadForm.fields.interestsNone")}</p>
        )}
      </fieldset>

      <section
        className="flex flex-col gap-4"
        data-testid="lead-consents"
        aria-labelledby="lead-consent-title"
      >
        <h2 id="lead-consent-title" className="text-title text-ink font-semibold">
          {t("leadForm.consent.title")}
        </h2>
        <p className="text-body text-ink-muted">{t("leadForm.consent.separate")}</p>
        <ConsentCheckbox
          testId="consent-report"
          name="consent-report"
          required
          label={localize(consent.reportDelivery)}
          checked={values.reportConsent}
          error={errorText("reportConsent", errors)}
          onChange={(checked) => onChange("reportConsent", checked)}
        />
        <ConsentCheckbox
          testId="consent-follow-up"
          name="consent-follow-up"
          label={localize(consent.salesFollowUp)}
          checked={values.followUpConsent}
          onChange={(checked) => onChange("followUpConsent", checked)}
        />
        <p className="text-body text-ink-muted flex items-start gap-3">
          <ShieldIcon className="text-primary mt-0.5" />
          {localize(consent.privacyNotice)}
        </p>
        <p className="text-caption text-ink-muted" data-testid="consent-version">
          {t("leadForm.consent.version", { version: consent.version })}
        </p>
        {consent.validationStatus !== "validated" && (
          <StatusBanner tone="warning" title={t("leadForm.consent.pendingReview")} />
        )}
      </section>
    </div>
  );
}

/** Step 3 — everything the visitor entered, before anything is sent ("Corregir mis datos" goes back). */
export function ReviewStep({
  values,
  content,
  interests,
}: {
  values: LeadFormValues;
  content: LeadCaptureContent;
  interests: InterestOption[];
}) {
  const { t, localize } = useLanguage();
  const role = content.personas.find((p) => p.id === values.roleId);
  const chosen = interests.filter((i) => values.interestIds.includes(i.id));
  const row = (label: string, value: ReactNode, testId: string) => (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
      <dt className="text-label text-ink-muted font-semibold sm:w-64 sm:shrink-0">{label}</dt>
      <dd className="text-lead text-ink break-words" data-testid={testId} data-selectable>
        {value}
      </dd>
    </div>
  );
  const yesNo = (granted: boolean) =>
    granted ? t("leadForm.review.granted") : t("leadForm.review.notGranted");
  return (
    <div className="flex flex-col gap-8" data-testid="lead-review">
      <section className="flex flex-col gap-4">
        <h2 className="text-title text-ink font-semibold">{t("leadForm.review.contact")}</h2>
        <dl className="flex flex-col gap-4">
          {row(
            t("leadForm.review.name"),
            `${values.firstName.trim()} ${values.lastName.trim()}`,
            "review-name",
          )}
          {row(t("leadForm.fields.organization"), values.organization.trim(), "review-organization")}
          {row(t("leadForm.fields.email"), values.email.trim().toLowerCase(), "review-email")}
          {row(
            t("leadForm.fields.phone"),
            values.phone.trim() || t("leadForm.review.noPhone"),
            "review-phone",
          )}
        </dl>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-title text-ink font-semibold">{t("leadForm.review.preferences")}</h2>
        <dl className="flex flex-col gap-4">
          {row(t("leadForm.fields.role"), role ? localize(role.label) : "—", "review-role")}
          {row(t("leadForm.fields.language"), t(`language.${values.language}`), "review-language")}
          {row(
            t("leadForm.fields.interests"),
            chosen.length > 0
              ? chosen.map((i) => localize(i.label)).join(" · ")
              : t("leadForm.review.noInterests"),
            "review-interests",
          )}
          {row(t("leadForm.review.reportConsent"), yesNo(values.reportConsent), "review-report-consent")}
          {row(
            t("leadForm.review.followUpConsent"),
            yesNo(values.followUpConsent),
            "review-follow-up-consent",
          )}
        </dl>
      </section>
    </div>
  );
}
