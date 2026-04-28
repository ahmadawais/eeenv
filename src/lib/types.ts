/**
 * Shared branded types so we can't accidentally mix raw strings.
 */

declare const brand: unique symbol;
export type Brand<T, B> = T & { readonly [brand]: B };

export type AbsPath = Brand<string, "AbsPath">;
export type EnvFileName = Brand<string, "EnvFileName">;

export type FileState = "hidden";
