import type { ReactNode } from "react";

/** Shared centered layout for LoadingState, EmptyState and ErrorState. */
export function StateLayout({
  icon,
  title,
  body,
  children,
  testId,
  role,
  headingLevel = 1,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  children?: ReactNode;
  testId?: string;
  role?: "status" | "alert";
  /** Use 1 for full-screen states, 2–3 when embedded in a page section. */
  headingLevel?: 1 | 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      data-testid={testId}
      role={role}
      className="px-gutter flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center"
    >
      {icon}
      <Heading className="text-ink text-headline font-bold tracking-tight text-balance">{title}</Heading>
      {body && <p className="text-ink-muted text-lead max-w-2xl text-pretty">{body}</p>}
      {children && <div className="mt-4 flex flex-wrap items-center justify-center gap-4">{children}</div>}
    </section>
  );
}
