import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { KioskHeaderActions } from "@/features/kiosk/kiosk-header-actions";
import { KioskSessionProvider } from "@/features/kiosk/state/kiosk-session-provider";
import { getServerEnv } from "@/server/env";

/** Visitor experience and development tools: kiosk session store and shell (ADR-004, ADR-056). */
export default async function KioskLayout({ children }: LayoutProps<"/">) {
  // Render per request so CONTENT_MODE is read from the running server's environment, not the build.
  await connection();
  const env = getServerEnv();
  return (
    <KioskSessionProvider>
      <AppShell contentMode={env.CONTENT_MODE} headerActions={<KioskHeaderActions />}>
        {children}
      </AppShell>
    </KioskSessionProvider>
  );
}
