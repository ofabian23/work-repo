import { AdminPage } from "@/features/admin/admin-ui";
import { requireAdmin } from "@/server/admin";

/** Content items still pending validation (Puerto Rico sales, legal or marketing). Read-only. */
export default async function AdminContentPage() {
  const { service } = await requireAdmin();
  const rows = service.pendingValidation();
  return (
    <AdminPage
      title="Contenido pendiente de validación"
      lead={`${rows.length} elemento(s) requieren validación antes del modo de producción. Descargue la lista completa en Exportaciones.`}
    >
      <div className="overflow-x-auto">
        <table className="text-body w-full border-collapse text-left" data-testid="admin-pending-content">
          <thead>
            <tr className="border-line text-ink-muted border-b">
              <th className="p-2">Tipo</th>
              <th className="p-2">Elemento</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Validación de ventas PR</th>
              <th className="p-2">Disponibilidad en PR</th>
              <th className="p-2">Decisión</th>
              <th className="p-2">Recurso faltante</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.record_type}-${r.id}`}
                className="border-line border-b"
                data-testid="admin-pending-row"
              >
                <td className="p-2">{r.record_type}</td>
                <td className="p-2">
                  <span className="font-semibold">{r.name_es}</span>
                  <span className="text-caption text-ink-muted block">{r.id}</span>
                </td>
                <td className="p-2">{r.validation_status}</td>
                <td className="p-2">{r.requires_sales_validation}</td>
                <td className="p-2">{r.pr_availability || "—"}</td>
                <td className="p-2">{r.review_decision || "—"}</td>
                <td className="p-2">{r.missing_asset || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
