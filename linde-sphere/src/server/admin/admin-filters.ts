import { z } from "zod";

/**
 * Admin list filters (ADR-056). They travel in the query string, so they may contain only dates and
 * statuses — never personal data. Invalid values are ignored rather than rejected.
 */
export const LEAD_STATUSES = ["active", "archived", "erasure_requested"] as const;
export const DELIVERY_STATUSES = ["pending", "sent", "failed", "retrying"] as const;

const FIELDS = {
  from: z.iso.date(),
  to: z.iso.date(),
  status: z.enum(LEAD_STATUSES),
  delivery: z.enum(DELIVERY_STATUSES),
  exported: z.enum(["yes", "no"]),
  page: z.coerce.number().int().min(1).max(10_000),
};

export type AdminFilters = {
  from?: string;
  to?: string;
  status?: (typeof LEAD_STATUSES)[number];
  delivery?: (typeof DELIVERY_STATUSES)[number];
  exported?: "yes" | "no";
  page: number;
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

export function parseAdminFilters(raw: RawParams): AdminFilters {
  const get = (key: string) => {
    const value = raw instanceof URLSearchParams ? raw.get(key) : raw[key];
    const single = Array.isArray(value) ? value[0] : value;
    return single === null || single === undefined || single === "" ? undefined : single;
  };
  const pick = <K extends keyof typeof FIELDS>(key: K) => {
    const result = FIELDS[key].safeParse(get(key));
    return result.success ? (result.data as z.output<(typeof FIELDS)[K]>) : undefined;
  };
  const filters: AdminFilters = {
    from: pick("from"),
    to: pick("to"),
    status: pick("status"),
    delivery: pick("delivery"),
    exported: pick("exported"),
    page: pick("page") ?? 1,
  };
  // A reversed range is swapped instead of silently returning nothing.
  if (filters.from && filters.to && filters.from > filters.to)
    [filters.from, filters.to] = [filters.to, filters.from];
  return filters;
}

/** Puerto Rico has no daylight saving time: dates are whole days at UTC−04:00. */
export const EVENT_UTC_OFFSET = "-04:00";

export function dateRange(filters: Pick<AdminFilters, "from" | "to">): { gte?: Date; lte?: Date } {
  return {
    ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000${EVENT_UTC_OFFSET}`) } : {}),
    ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999${EVENT_UTC_OFFSET}`) } : {}),
  };
}

/** Query string for links and forms (only the filters; page omitted unless > 1). */
export function filtersToQuery(filters: AdminFilters, { withPage = false } = {}): string {
  const params = new URLSearchParams();
  for (const key of ["from", "to", "status", "delivery", "exported"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (withPage && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return query ? `?${query}` : "";
}
