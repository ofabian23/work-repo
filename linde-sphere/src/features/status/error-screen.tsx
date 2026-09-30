"use client";

import { ErrorState } from "@/components/feedback/error-state";
import { appConfig } from "@/lib/config/app-config";

export function ErrorScreen({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  return (
    <div data-testid="error-screen" className="flex flex-1 flex-col">
      <ErrorState
        headingLevel={1}
        digest={digest}
        onRetry={onRetry}
        onHome={() => window.location.replace(appConfig.routes.home)}
      />
    </div>
  );
}
