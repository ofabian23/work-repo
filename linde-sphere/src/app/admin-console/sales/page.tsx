import {
  AdminPage,
  APPROVAL_LABELS,
  AVAILABILITY_LABELS,
  button,
  DECISION_LABELS,
  input,
  Notice,
  RECORD_TYPE_LABELS,
  secondaryButton,
  Stat,
} from "@/features/admin/admin-ui";
import { APPROVAL_STATUSES } from "@/domain/content/sales-review";
import { SALES_RECORD_TYPES, type SalesValidationRow } from "@/domain/review/sales-validation";
import { requireAdmin } from "@/server/admin";

const list = (values: string[]) => (values.length > 0 ? values.join("; ") : "—");
const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | "" =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : "";

/**
 * Sales-validation worksheet (ADR-060): every persona, challenge, solution and digital asset with the
 * answers the Puerto Rico sales team must give (SALES_VALIDATION_GUIDE.md). Read-only: answers are
 * recorded in the content files by the project team, then checked by `npm run content:check`.
 * Filters are content types and statuses only (no personal data in URLs).
 */
export default async function AdminSalesValidationPage({ searchParams }: PageProps<"/admin-console/sales">) {
  const { config, service } = await requireAdmin();
  const base = config.basePath;
  const params = await searchParams;
  const type = pick(params.type, SALES_RECORD_TYPES);
  const approval = pick(params.approval, APPROVAL_STATUSES);
  const { rows, summary } = service.salesValidation();
  const shown = rows.filter(
    (r) => (!type || r.recordType === type) && (!approval || r.approvalStatus === approval),
  );

  return (
    <AdminPage
      title="Validación de ventas"
      lead={
        <>
          Revisión de cada rol, reto, solución y material digital por el equipo de ventas de Puerto Rico. En
          modo de producción solo aparece el contenido validado y aprobado; en modo demo el resto se muestra
          con el indicador «pendiente de validación». Guía: SALES_VALIDATION_GUIDE.md.
        </>
      }
    >
      {params.error === "confirm" && (
        <Notice tone="error">Confirme la descarga antes de exportar la hoja de validación.</Notice>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="sales-summary">
        <Stat label="Elementos" value={summary.total} testId="sales-total" />
        <Stat label="Listos para producción" value={summary.productionReady} testId="sales-ready" />
        <Stat label="Aprobados" value={summary.byApproval.approved} />
        <Stat label="Cambios solicitados" value={summary.byApproval["changes-requested"]} />
      </div>
      <p className="text-body text-ink-muted" data-testid="sales-by-type">
        {SALES_RECORD_TYPES.map(
          (t) =>
            `${RECORD_TYPE_LABELS[t]}: ${summary.byType[t].approved}/${summary.byType[t].total} aprobados`,
        ).join(" · ")}
      </p>

      <form method="get" className="flex flex-wrap items-end gap-4" data-testid="sales-filters">
        <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
          Tipo
          <select className={input} name="type" defaultValue={type} data-testid="sales-filter-type">
            <option value="">Todos</option>
            {SALES_RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECORD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
          Aprobación
          <select
            className={input}
            name="approval"
            defaultValue={approval}
            data-testid="sales-filter-approval"
          >
            <option value="">Todas</option>
            {APPROVAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPROVAL_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={button} data-testid="sales-filter-apply">
          Filtrar
        </button>
        <a className={secondaryButton} href={`${base}/sales`}>
          Quitar filtros
        </a>
      </form>

      <p className="text-body text-ink-muted" data-testid="sales-result-count">
        {shown.length} de {rows.length} elemento(s)
      </p>
      <div className="flex flex-col gap-4" data-testid="sales-items">
        {shown.map((r) => (
          <SalesItem key={`${r.recordType}-${r.id}`} row={r} />
        ))}
      </div>

      <form
        method="post"
        action={`${base}/api/export`}
        className="rounded-card border-line bg-surface flex flex-col gap-4 border p-5"
        data-testid="sales-export-form"
      >
        <h2 className="text-lead font-bold">Hoja de validación de ventas (CSV)</h2>
        <p className="text-body text-ink-muted">
          Todos los elementos con los 16 campos de revisión, para completar y devolver según la guía. No
          contiene datos personales de visitantes.
        </p>
        <input type="hidden" name="kind" value="sales" />
        <label className="text-body text-ink flex items-start gap-3">
          <input
            type="checkbox"
            name="confirm"
            value="yes"
            className="mt-1 size-5"
            data-testid="sales-export-confirm"
          />
          <span>Confirmo la descarga de la hoja de validación (uso interno de Linde).</span>
        </label>
        <button type="submit" className={`${button} self-start`} data-testid="sales-export-submit">
          Descargar CSV
        </button>
      </form>
    </AdminPage>
  );
}

function SalesItem({ row: r }: { row: SalesValidationRow }) {
  const fields: [string, string][] = [
    ["Nombre en español", r.spanishName],
    ["Nombre en inglés", r.englishName],
    ["Descripción actual", `${r.currentDescription.es} (EN: ${r.currentDescription.en})`],
    ["Estado de mercado", r.marketStatus],
    ["Estado de validación", r.validationStatus],
    ["Roles previstos", list(r.intendedPersonas)],
    ["Retos previstos", list(r.intendedChallenges)],
    ["Áreas de salud previstas", list(r.intendedHealthcareAreas)],
    ["Prioridad de recomendación", r.recommendationPriority],
    ["Disponible en Puerto Rico", AVAILABILITY_LABELS[r.availableInPuertoRico] ?? r.availableInPuertoRico],
    ["Mantener / eliminar / renombrar", DECISION_LABELS[r.decision] ?? r.decision],
    ["Corrección requerida", r.requiredCorrection || "—"],
    ["Material digital faltante", r.missingDigitalMaterial || "—"],
    ["Responsable de ventas", r.salesOwner || "Sin asignar"],
  ];
  return (
    <article
      className="rounded-card border-line bg-surface flex flex-col gap-3 border p-4"
      data-testid="sales-item"
      data-record-type={r.recordType}
      data-approval={r.approvalStatus}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-caption text-ink-muted font-semibold">
            {RECORD_TYPE_LABELS[r.recordType]} · {r.id}
          </span>
          <h2 className="text-lead text-ink font-bold break-words">
            {r.currentName.es}
            {r.currentName.en !== r.currentName.es && (
              <span className="text-body text-ink-muted font-normal"> / {r.currentName.en}</span>
            )}
          </h2>
        </div>
        <span
          className={`text-caption rounded-full px-3 py-1 font-semibold ${
            r.productionReady ? "bg-success-surface text-success" : "bg-notice-surface text-notice"
          }`}
          data-testid="sales-approval"
        >
          {APPROVAL_LABELS[r.approvalStatus]}
          {r.productionReady ? " · en producción" : " · no se muestra en producción"}
        </span>
      </header>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col">
            <dt className="text-caption text-ink-muted font-semibold">{label}</dt>
            <dd className="text-body text-ink break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
