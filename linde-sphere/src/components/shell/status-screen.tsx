import type { ReactNode } from "react";

/** Centered full-area message used by loading, error and not-found states. */
export function StatusScreen({
  icon,
  title,
  body,
  children,
  testId,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="flex flex-1 flex-col items-center justify-center gap-6 px-[8%] py-16 text-center"
    >
      {icon}
      <h1 className="text-ink text-4xl font-bold tracking-tight text-balance">{title}</h1>
      {body && <p className="text-ink-muted max-w-2xl text-xl text-pretty">{body}</p>}
      {children && <div className="mt-4 flex flex-wrap items-center justify-center gap-4">{children}</div>}
    </section>
  );
}
