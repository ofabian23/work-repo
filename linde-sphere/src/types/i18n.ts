import type { es } from "@/data/i18n/es";

/** Same shape as the Spanish dictionary, with string literals widened to `string`. */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Messages = Widen<typeof es>;

/** Dot-separated path to every string leaf, e.g. `"home.paths.role.title"`. */
type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
export type MessageKey = LeafPaths<Messages>;

export type MessageParams = Record<string, string | number>;
