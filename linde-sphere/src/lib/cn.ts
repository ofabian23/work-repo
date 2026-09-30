/** Joins class names, skipping falsy values. Tiny local helper instead of a dependency. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
