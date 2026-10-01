import {
  AdminPage,
  button,
  DELIVERY_LABELS,
  input,
  LEAD_STATUS_LABELS,
  Notice,
} from "@/features/admin/admin-ui";
import { requireAdmin } from "@/server/admin";
import { DELIVERY_STATUSES, LEAD_STATUSES } from "@/server/admin/admin-filters";

function Confirm({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <label className="text-body text-ink flex items-start gap-3">
      <input
        type="checkbox"
        name="confirm"
        value="yes"
        required
        className="mt-1 size-5"
        data-testid={testId}
      />
      <span>{children}</span>
    </label>
  );
}

/** Confirmed exports and the database backup. Files are generated on request and never stored on the server. */
export default async function AdminExportsPage({ searchParams }: PageProps<"/admin-console/exports">) {
  const { config } = await requireAdmin();
  const base = config.basePath;
  const { error } = await searchParams;
  const section = "rounded-card border-line bg-surface flex flex-col gap-4 border p-5";
  return (
    <AdminPage
      title="Exportaciones y respaldo"
      lead="Los archivos contienen datos personales de contacto: guárdelos en almacenamiento cifrado, compártalos solo por el canal aprobado y bórrelos cuando ya no los necesite."
    >
      {error === "confirm" && (
        <Notice tone="error">Confirme el manejo seguro del archivo antes de descargarlo.</Notice>
      )}

      <form method="post" action={`${base}/api/export`} className={section} data-testid="export-package-form">
        <h2 className="text-lead font-bold">Paquete de seguimiento de la convención (ZIP)</h2>
        <p className="text-body text-ink-muted">
          La entrega principal del modo de paquete local: <code>leads.csv</code> y la carpeta{" "}
          <code>reports/</code> con el resumen personalizado de cada lead activo (HTML, texto y JSON). Los
          nombres de las carpetas son identificadores opacos, sin datos personales.
        </p>
        <input type="hidden" name="kind" value="package" />
        <div className="flex flex-wrap gap-4">
          <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
            Desde
            <input className={input} type="date" name="from" />
          </label>
          <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
            Hasta
            <input className={input} type="date" name="to" />
          </label>
          <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
            Exportado
            <select className={input} name="exported" defaultValue="">
              <option value="">Todos</option>
              <option value="no">Solo no exportados</option>
              <option value="yes">Solo exportados</option>
            </select>
          </label>
        </div>
        <label className="text-body text-ink flex items-start gap-3">
          <input
            type="checkbox"
            name="markExported"
            value="yes"
            className="mt-1 size-5"
            data-testid="export-package-mark"
          />
          <span>Marcar los leads incluidos como exportados (estado de seguimiento: exportado)</span>
        </label>
        <Confirm testId="export-package-confirm">
          Confirmo que manejaré este paquete con datos personales de forma segura y que solo daré seguimiento
          comercial a quienes lo autorizaron.
        </Confirm>
        <button type="submit" className={`${button} self-start`} data-testid="export-package-submit">
          Descargar paquete
        </button>
      </form>

      <form method="post" action={`${base}/api/export`} className={section} data-testid="export-leads-form">
        <h2 className="text-lead font-bold">Leads e intereses (CSV)</h2>
        <div className="flex flex-wrap gap-4">
          <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
            Archivo
            <select className={input} name="kind" defaultValue="leads" data-testid="export-kind">
              <option value="leads">Un lead por fila (intereses agrupados)</option>
              <option value="interests">Un interés por fila</option>
            </select>
          </label>
          <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
            Desde
            <input className={input} type="date" name="from" />
          </label>
          <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
            Hasta
            <input className={input} type="date" name="to" />
          </label>
          <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
            Estado
            <select className={input} name="status" defaultValue="">
              <option value="">Todos</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
            Envío
            <select className={input} name="delivery" defaultValue="">
              <option value="">Todos</option>
              {DELIVERY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DELIVERY_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
            Exportado
            <select className={input} name="exported" defaultValue="">
              <option value="">Todos</option>
              <option value="no">Solo no exportados</option>
              <option value="yes">Solo exportados</option>
            </select>
          </label>
        </div>
        <label className="text-body text-ink flex items-start gap-3">
          <input
            type="checkbox"
            name="markExported"
            value="yes"
            className="mt-1 size-5"
            data-testid="export-mark"
          />
          <span>Marcar los leads incluidos como exportados</span>
        </label>
        <Confirm testId="export-leads-confirm">
          Confirmo que manejaré este archivo con datos personales de forma segura y que solo daré seguimiento
          comercial a quienes lo autorizaron.
        </Confirm>
        <button type="submit" className={`${button} self-start`} data-testid="export-leads-submit">
          Descargar CSV
        </button>
      </form>

      <form method="post" action={`${base}/api/export`} className={section} data-testid="export-content-form">
        <h2 className="text-lead font-bold">Lista de validación de contenido (CSV)</h2>
        <p className="text-body text-ink-muted">
          Todos los elementos de contenido con su estado, para la revisión del equipo de ventas de Puerto
          Rico.
        </p>
        <input type="hidden" name="kind" value="content" />
        <Confirm testId="export-content-confirm">Confirmo la descarga del archivo de validación.</Confirm>
        <button type="submit" className={`${button} self-start`} data-testid="export-content-submit">
          Descargar CSV
        </button>
      </form>

      <form method="post" action={`${base}/api/backup`} className={section} data-testid="backup-form">
        <h2 className="text-lead font-bold">Respaldo de la base de datos</h2>
        <p className="text-body text-ink-muted">
          Copia completa y consistente (SQLite) de todos los leads, informes y envíos. Guárdela solo en
          almacenamiento cifrado.
        </p>
        <Confirm testId="backup-confirm">
          Confirmo que guardaré el respaldo en almacenamiento cifrado.
        </Confirm>
        <button type="submit" className={`${button} self-start`} data-testid="backup-submit">
          Descargar respaldo
        </button>
      </form>
    </AdminPage>
  );
}
