"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/features/status/error-screen";

/** Segment error boundary (rendered inside the root layout, so the shell and language stay available). */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Log only the digest: error messages could contain visitor data in later phases.
    console.error("Linde Sphere UI error", error.digest ?? "(no digest)");
  }, [error]);

  return <ErrorScreen digest={error.digest} onRetry={retry} />;
}
