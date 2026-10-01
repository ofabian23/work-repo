import "server-only";
import type { AdminFilters } from "@/server/admin/admin-filters";
import type { AdminRepository } from "@/server/admin/admin-repository";
import { LEAD_CSV_COLUMNS, leadCsvRow } from "@/server/admin/lead-csv";
import { toCsv } from "@/lib/csv";
import type { Logger } from "@/server/logging/logger";
import { createZip, type ZipEntry } from "./zip";

/**
 * Convention Export Package (ADR-062): the primary output of the LOCAL_PACKAGE follow-up mode.
 *
 *   leads.csv                       one lead per row (the admin lead CSV plus `report_folder`)
 *   reports/<leadId>/report.html    the personalized report as the visitor would read it
 *   reports/<leadId>/report.txt     the plain-text version
 *   reports/<leadId>/report.json    the structured report data (when stored; older rows have none)
 *   LEEME.txt                       what the package contains and how to handle it
 *
 * Folder names are opaque lead ids, so no personal data appears in file names. Only active leads are
 * included (never archived ones or erasure requests). The package is built in memory on request: the admin
 * download streams it and the CLI writes it to a private file. Logs carry counts and filters only.
 */
export type PackageFilters = Pick<AdminFilters, "from" | "to" | "exported">;

export const PACKAGE_CSV_COLUMNS = [...LEAD_CSV_COLUMNS, "report_folder"] as const;

const README = `Linde Sphere · Paquete de seguimiento de la convención

Contenido
- leads.csv: un lead por fila, con sus permisos, intereses, modo y estado de seguimiento, y la carpeta de su
  informe (report_folder). Columnas internal_*: puntaje interno basado en supuestos pendientes de validación
  de ventas; nunca se comparte con el visitante.
- reports/<id>/report.html, report.txt y report.json: el resumen personalizado que solicitó cada visitante.

Uso
- Dé seguimiento comercial solo a quienes lo autorizaron (follow_up_consent = true). Todos autorizaron
  recibir su resumen (report_consent = true).
- El archivo contiene datos personales de contacto: guárdelo en almacenamiento cifrado, compártalo solo por
  el canal aprobado por Linde y bórrelo cuando ya no lo necesite. La política de retención está pendiente
  de aprobación (PRIVACY_REVIEW.md).
- No contiene información de pacientes.
`;

const stamp = (d: Date) => d.toISOString().slice(0, 19).replace(/[:T]/g, "-");

export async function buildConventionPackage({
  repo,
  filters,
  markExported = false,
  now = () => new Date(),
  logger,
}: {
  repo: Pick<AdminRepository, "exportLeads" | "reportsFor" | "markExported">;
  filters: PackageFilters;
  markExported?: boolean;
  now?: () => Date;
  logger: Logger;
}): Promise<{ filename: string; bytes: Buffer; leads: number; reports: number; marked: number }> {
  const generatedAt = now();
  const leads = await repo.exportLeads({ ...filters, status: "active", page: 1 });
  const reports = new Map((await repo.reportsFor(leads.map((l) => l.id))).map((r) => [r.leadId, r]));

  const entries: ZipEntry[] = [{ name: "LEEME.txt", data: README }];
  const rows = leads.map((lead) => {
    const report = reports.get(lead.id);
    const folder = report ? `reports/${lead.id}/` : "";
    if (report) {
      entries.push({ name: `${folder}report.html`, data: report.html });
      entries.push({ name: `${folder}report.txt`, data: report.text });
      if (report.payloadJson) {
        entries.push({
          name: `${folder}report.json`,
          data: JSON.stringify(
            {
              leadId: lead.id,
              language: report.language,
              subject: report.subject,
              report: JSON.parse(report.payloadJson),
            },
            null,
            2,
          ),
        });
      }
    }
    return [...leadCsvRow(lead), folder];
  });
  entries.splice(1, 0, { name: "leads.csv", data: toCsv([[...PACKAGE_CSV_COLUMNS], ...rows]) });

  const bytes = createZip(entries, generatedAt);
  const marked = markExported
    ? await repo.markExported(
        leads.map((l) => l.id),
        generatedAt,
      )
    : 0;
  // Counts and filters only: exported data never reaches the logs.
  logger.info("follow_up.package", {
    leads: leads.length,
    reports: reports.size,
    marked,
    from: filters.from ?? null,
    to: filters.to ?? null,
    exported: filters.exported ?? null,
  });
  return {
    filename: `linde-sphere-follow-up-package-${stamp(generatedAt)}.zip`,
    bytes,
    leads: leads.length,
    reports: reports.size,
    marked,
  };
}
