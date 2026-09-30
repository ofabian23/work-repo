import path from "node:path";
import { expect } from "vitest";
import type { z } from "zod";
import type { ContentBundle } from "@/domain/content";
import { loadContentFromDirectory } from "@/server/content/load-content";

export const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
export const CONTENT_DIR = path.join(PROJECT_ROOT, "content");

/** Asserts the value parses successfully and returns the parsed output. */
export function expectValid<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Expected valid, got:\n${JSON.stringify(result.error.issues, null, 2)}`);
  }
  return result.data;
}

/**
 * Asserts parsing fails with an issue at `path` (dot/bracket notation, "" for root)
 * whose message contains `messagePart` when given.
 */
export function expectInvalid(schema: z.ZodType, value: unknown, path: string, messagePart?: string): void {
  const result = schema.safeParse(value);
  expect(result.success, "expected validation to fail").toBe(false);
  if (result.success) return;
  const issues = result.error.issues.map((i) => ({
    path: i.path
      .map((p, idx) => (typeof p === "number" ? `[${p}]` : idx === 0 ? String(p) : `.${String(p)}`))
      .join(""),
    message: i.message,
  }));
  const match = issues.find(
    (i) => i.path === path && (messagePart === undefined || i.message.includes(messagePart)),
  );
  expect(
    match,
    `no issue at '${path}'${messagePart ? ` containing '${messagePart}'` : ""}; got ${JSON.stringify(issues)}`,
  ).toBeDefined();
}

export function loadSeedBundle(): ContentBundle {
  const result = loadContentFromDirectory(CONTENT_DIR, { projectRoot: PROJECT_ROOT });
  if (!result.bundle)
    throw new Error(`Seed content failed to load: ${JSON.stringify(result.issues, null, 2)}`);
  return result.bundle;
}

/** Deep clone so tests can mutate freely. */
export const clone = <T>(value: T): T => structuredClone(value);
