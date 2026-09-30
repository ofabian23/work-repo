import {
  AdminPage,
  DELIVERY_LABELS,
  formatDate,
  input,
  LEAD_STATUS_LABELS,
  secondaryButton,
  Stat,
  button,
} from "@/features/admin/admin-ui";
import { requireAdmin } from "@/server/admin";
import {
  DELIVERY_STATUSES,
  filtersToQuery,
  LEAD_STATUSES,
  parseAdminFilters,
} from "@/server/admin/admin-filters";

const PAGE_SIZE = 50;

/** Aggregate counts and the filtered lead list. Filters are dates and statuses only (no personal data). */
export default async function AdminHomePage({ searchParams }: PageProps<"/admin-console">) {
  const { config, service } = await requireAdmin();
  const base = config.basePath;
  const filters = parseAdminFilters(await searchParams);
  const [overview, { rows, total }] = await Promise.all([
    service.overview(filters),
    service.listLeads(filters, PAGE_SIZE),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (page: number) => `${base}${filtersToQuery({ ...filters, page }, { withPage: true })}`;

  return (
    <AdminPage title="Leads" lead="Datos de contacto de negocio recogidos en el espacio de exhibición.">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="admin-overview">
        <Stat label="Leads (con filtros)" value={overview.total} testId="stat-total" />
        <Stat label="Exportados" value={overview.exported} testId="stat-exported" />
        <Stat label="Resumen enviado" value={overview.byDelivery.sent} testId="stat-sent" />
        <Stat
          label="Envío fallido o reintentando"
          value={overview.byDelivery.failed + overview.byDelivery.retrying}
          testId="stat-attention"
        />
      </div>

      <form
        method="get"
        action={base}
        className="rounded-card border-line bg-surface flex flex-wrap items-end gap-4 border p-4"
        data-testid="admin-filters"
      >
        <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
          Desde
          <input className={input} type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
          Hasta
          <input className={input} type="date" name="to" defaultValue={filters.to} />
        </label>
        <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
          Estado del lead
          <select className={input} name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-label flex max-w-full min-w-0 flex-col gap-1 font-semibold">
          Envío del resumen
          <select
            className={input}
            name="delivery"
            defaultValue={filters.delivery ?? ""}
            data-testid="filter-delivery"
          >
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
          <select className={input} name="exported" defaultValue={filters.exported ?? ""}>
            <option value="">Todos</option>
            <option value="yes">Sí</option>
            <option value="no">No</option>
          </select>
        </label>
        <button type="submit" className={button} data-testid="filter-apply">
          Filtrar
        </button>
        <a className={secondaryButton} href={base}>
          Quitar filtros
        </a>
      </form>

      <p className="text-body text-ink-muted" data-testid="admin-result-count">
        {total} lead(s) · página {filters.page} de {pages}
      </p>
      <div role="region" aria-label="Tabla de leads" tabIndex={0} className="focus-ring overflow-x-auto">
        <table className="text-body w-full border-collapse text-left" data-testid="admin-leads">
          <thead>
            <tr className="border-line text-ink-muted border-b">
              <th className="p-2">Fecha</th>
              <th className="p-2">Nombre</th>
              <th className="p-2">Organización</th>
              <th className="p-2">Área</th>
              <th className="p-2">Seguimiento</th>
              <th className="p-2">Envío</th>
              <th className="p-2">Exportado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => (
              <tr key={lead.id} className="border-line border-b" data-testid="admin-lead-row">
                <td className="p-2 whitespace-nowrap">{formatDate(lead.createdAt)}</td>
                <td className="p-2">
                  <a className="text-primary font-semibold underline" href={`${base}/leads/${lead.id}`}>
                    {lead.name}
                  </a>
                </td>
                <td className="p-2">{lead.organization}</td>
                <td className="p-2">{lead.roleLabel}</td>
                <td className="p-2">{lead.followUpConsent ? "Autorizado" : "No"}</td>
                <td className="p-2" data-testid="lead-delivery">
                  {lead.delivery ? DELIVERY_LABELS[lead.delivery.status] : "—"}
                </td>
                <td className="p-2">{lead.exportedAt ? formatDate(lead.exportedAt) : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Páginas" className="flex gap-4">
          {filters.page > 1 && (
            <a className={secondaryButton} href={pageLink(filters.page - 1)}>
              Anterior
            </a>
          )}
          {filters.page < pages && (
            <a className={secondaryButton} href={pageLink(filters.page + 1)}>
              Siguiente
            </a>
          )}
        </nav>
      )}
    </AdminPage>
  );
}
