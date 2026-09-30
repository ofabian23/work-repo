import { notFound } from "next/navigation";
import {
  AdminPage,
  button,
  DELIVERY_LABELS,
  formatDate,
  LEAD_STATUS_LABELS,
  Notice,
  secondaryButton,
} from "@/features/admin/admin-ui";
import { requireAdmin } from "@/server/admin";

const RESULTS: Record<string, { tone: "success" | "error" | "info"; text: string }> = {
  "retry-sent": { tone: "success", text: "Reintento realizado: el resumen se envió." },
  "retry-retrying": {
    tone: "info",
    text: "El reintento falló de forma temporal; se volverá a intentar automáticamente.",
  },
  "retry-failed": {
    tone: "error",
    text: "El reintento falló. Revise la configuración de correo (código abajo).",
  },
  "retry-skipped": { tone: "info", text: "El envío ya se está procesando o ya se completó." },
  "retry-not-retryable": { tone: "info", text: "Este envío no está fallido ni pendiente de reintento." },
  "retry-not-found": { tone: "error", text: "No se encontró el envío." },
  marked: { tone: "success", text: "El lead quedó marcado como exportado." },
  "already-marked": { tone: "info", text: "El lead ya estaba marcado como exportado." },
};

/** One lead: business contact information, interests and email-delivery state. No delete action (MVP). */
export default async function AdminLeadPage({
  params,
  searchParams,
}: PageProps<"/admin-console/leads/[id]">) {
  const { config, service } = await requireAdmin();
  const base = config.basePath;
  const { id } = await params;
  const { result } = await searchParams;
  const lead = /^[A-Za-z0-9_-]{1,64}$/.test(id) ? await service.leadDetail(id) : null;
  if (!lead) notFound();
  const message = typeof result === "string" ? RESULTS[result] : undefined;
  const row = (label: string, value: React.ReactNode, testId?: string) => (
    <div className="grid gap-1 sm:grid-cols-[14rem_1fr]">
      <dt className="text-ink-muted font-semibold">{label}</dt>
      <dd className="text-ink break-words" data-testid={testId}>
        {value}
      </dd>
    </div>
  );

  return (
    <AdminPage
      title={lead.name}
      lead={
        <a className="text-primary underline" href={base}>
          ← Volver a la lista
        </a>
      }
    >
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <section
        className="rounded-card border-line bg-surface flex flex-col gap-3 border p-5"
        data-testid="admin-lead-contact"
      >
        <h2 className="text-lead font-bold">Contacto de negocio</h2>
        <dl className="text-body flex flex-col gap-2">
          {row("Organización", lead.organization)}
          {row("Área o función", lead.roleLabel)}
          {row("Correo de trabajo", lead.businessEmail, "admin-lead-email")}
          {row("Teléfono", lead.optionalPhone ?? "—")}
          {row("Idioma", lead.preferredLanguage === "es" ? "Español" : "English")}
          {row("Permiso para el resumen", lead.reportConsent ? "Sí" : "No")}
          {row("Permiso de seguimiento", lead.followUpConsent ? "Sí" : "No", "admin-lead-follow-up")}
          {row(
            "Puntaje interno (solo uso interno)",
            `${lead.leadTier} · ${lead.leadScore}/100 — ${
              lead.leadScoreFactors
                .map((f) => `${f.code} ${f.points > 0 ? "+" : ""}${f.points}`)
                .join(", ") || "sin factores"
            } (pesos ${lead.leadScoringVersion}, pendientes de validación de ventas)`,
            "admin-lead-score",
          )}
          {row("Versión del consentimiento", lead.consentTextVersion)}
          {row("Estado", LEAD_STATUS_LABELS[lead.status] ?? lead.status)}
          {row("Recibido", formatDate(lead.createdAt))}
          {row("Exportado", lead.exportedAt ? formatDate(lead.exportedAt) : "No", "admin-lead-exported")}
        </dl>
        {!lead.exportedAt && (
          <form method="post" action={`${base}/api/mark-exported`}>
            <input type="hidden" name="leadId" value={lead.id} />
            <button type="submit" className={secondaryButton} data-testid="admin-mark-exported">
              Marcar como exportado
            </button>
          </form>
        )}
      </section>

      <section
        className="rounded-card border-line bg-surface flex flex-col gap-3 border p-5"
        data-testid="admin-lead-interests"
      >
        <h2 className="text-lead font-bold">Intereses</h2>
        {lead.interests.length === 0 ? (
          <p className="text-body text-ink-muted">Sin intereses registrados.</p>
        ) : (
          <div
            role="region"
            aria-label="Intereses del lead"
            tabIndex={0}
            className="focus-ring overflow-x-auto"
          >
            <table className="text-body w-full text-left">
              <thead>
                <tr className="text-ink-muted">
                  <th className="p-1">Tipo</th>
                  <th className="p-1">Elemento</th>
                  <th className="p-1">Origen</th>
                  <th className="p-1">Relevancia</th>
                </tr>
              </thead>
              <tbody>
                {lead.interests.map((i) => (
                  <tr key={`${i.category}-${i.value}-${i.sourceType}`}>
                    <td className="p-1">{i.category}</td>
                    <td className="p-1">{i.value}</td>
                    <td className="p-1">{i.sourceType}</td>
                    <td className="p-1">{i.relevance ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="rounded-card border-line bg-surface flex flex-col gap-3 border p-5"
        data-testid="admin-lead-delivery"
      >
        <h2 className="text-lead font-bold">Envío del resumen</h2>
        {lead.report && (
          <p className="text-body text-ink-muted">
            Informe generado ({lead.report.language.toUpperCase()}) el {formatDate(lead.report.createdAt)}: “
            {lead.report.subject}”
          </p>
        )}
        {lead.deliveries.map((d) => (
          <div key={d.id} className="flex flex-col gap-2">
            <p className="text-body">
              <strong data-testid="admin-delivery-status">{DELIVERY_LABELS[d.status] ?? d.status}</strong> ·
              proveedor {d.provider} · intentos {d.attempts}
              {d.errorCode && (
                <>
                  {" "}
                  · código <code data-testid="admin-delivery-error">{d.errorCode}</code>
                </>
              )}
              {d.nextAttemptAt && <> · próximo intento {formatDate(d.nextAttemptAt)}</>}
            </p>
            <ol className="text-caption text-ink-muted list-decimal pl-6">
              {d.events.map((e, i) => (
                <li key={i}>
                  {formatDate(e.occurredAt)} · {e.eventType}
                  {e.attempt > 0 ? ` (intento ${e.attempt})` : ""}
                  {e.errorCode ? ` · ${e.errorCode}` : ""}
                </li>
              ))}
            </ol>
            {(d.status === "failed" || d.status === "retrying") && (
              <form method="post" action={`${base}/api/retry`}>
                <input type="hidden" name="deliveryId" value={d.id} />
                <input type="hidden" name="leadId" value={lead.id} />
                <button type="submit" className={button} data-testid="admin-retry">
                  Reintentar envío ahora
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
    </AdminPage>
  );
}
