import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { minimatch } from "minimatch";
import { z } from "zod";
import type { AbsPath } from "./types.js";

/** Sane built-in defaults — always active unless overridden. */
export const DEFAULT_IGNORE = [".env.local", ".env.development", ".env.test"] as const;

const ConfigSchema = z.object({
	skipKeys: z.array(z.string()).default([]),
	ignoreFiles: z.array(z.string()).default([...DEFAULT_IGNORE]),
});

export type ProjectConfig = z.infer<typeof ConfigSchema>;

export function emptyConfig(): ProjectConfig {
	return ConfigSchema.parse({});
}

export async function readProjectConfig(projectDir: AbsPath): Promise<ProjectConfig> {
	const p = path.join(projectDir, ".eeenv.json");
	if (!existsSync(p)) return emptyConfig();

	const raw = await safeRead(p);
	if (raw === null) return emptyConfig();

	const parsed = safeParse(raw);
	if (!parsed) return emptyConfig();

	const result = ConfigSchema.safeParse(parsed);
	if (!result.success) return emptyConfig();
	return result.data;
}

export function shouldIgnore(relPath: string, patterns: readonly string[]): boolean {
	if (patterns.length === 0) return false;
	for (const p of patterns) {
		if (minimatch(relPath, p, { matchBase: true, dot: true })) return true;
	}
	return false;
}

async function safeRead(p: string): Promise<string | null> {
	try {
		return await fs.readFile(p, "utf8");
	} catch {
		return null;
	}
}

function safeParse(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
