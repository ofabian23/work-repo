import type { ReactNode } from "react";

/**
 * Plain server-rendered building blocks for the local administration utility (ADR-056): no client
 * JavaScript, standard forms and links, the kiosk's design tokens.
 */
export function AdminPage({
  title,
  children,
  lead,
}: {
  title: string;
  children: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-ink font-bold">{title}</h1>
        {lead && <div className="text-body text-ink-muted">{lead}</div>}
      </header>
      {children}
    </section>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "error";
  children: ReactNode;
}) {
  const tones = {
    info: "bg-info-surface text-info border-info/30",
    success: "bg-success-surface text-success border-success/30",
    error: "bg-danger-surface text-danger border-danger/30",
  };
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-card text-body border-2 p-4 ${tones[tone]}`}
    >
      {children}
    </p>
  );
}

export function Stat({ label, value, testId }: { label: string; value: number; testId?: string }) {
  return (
    <div className="rounded-card border-line bg-surface flex flex-col gap-1 border p-4" data-testid={testId}>
      <span className="text-caption text-ink-muted font-semibold">{label}</span>
      <span className="text-title text-ink font-bold tabular-nums">{value}</span>
    </div>
  );
}

export const button =
  "focus-ring rounded-control bg-primary text-on-primary text-label inline-flex min-h-12 items-center justify-center px-5 font-semibold";
export const secondaryButton =
  "focus-ring rounded-control border-primary text-primary bg-surface text-label inline-flex min-h-12 items-center justify-center border-2 px-5 font-semibold";
export const input = "focus-ring rounded-control border-line bg-surface text-body min-h-12 border-2 px-3";

export const DELIVERY_LABELS: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  failed: "Fallido",
  retrying: "Reintentando",
};
export const LEAD_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  archived: "Archivado",
  erasure_requested: "Borrado solicitado",
};

export const formatDate = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat("es-PR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Puerto_Rico",
      }).format(d)
    : "—";
