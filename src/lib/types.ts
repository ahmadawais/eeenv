/**
 * Shared branded types so we can't accidentally mix raw strings.
 */

declare const brand: unique symbol;
export type Brand<T, B> = T & { readonly [brand]: B };

export type AbsPath = Brand<string, "AbsPath">;
export type EnvFileName = Brand<string, "EnvFileName">;
/** POSIX-style relative path from the project root, e.g. `apps/web/.env`. */
export type RelPath = Brand<string, "RelPath">;

export type FileState = "hidden";
