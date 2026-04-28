import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const PackageJson = z.object({ version: z.string().min(1) });

/**
 * Read version from the nearest package.json, walking up from this file.
 * tsup outputs a single bundle in dist/, so package.json sits one level up.
 */
export function readVersion(): string {
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		join(here, "..", "package.json"),
		join(here, "..", "..", "package.json"),
	];
	for (const p of candidates) {
		try {
			const raw = readFileSync(p, "utf8");
			const parsed = PackageJson.parse(JSON.parse(raw));
			return parsed.version;
		} catch {
			// try next candidate
		}
	}
	return "0.0.0";
}
