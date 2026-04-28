import fs from "node:fs/promises";
import path from "node:path";
import type { AbsPath, EnvFileName } from "./types.js";

const EXCLUDE: ReadonlySet<string> = new Set([
	".env.example",
	".env.sample",
	".env.template",
	".env.dist",
]);

/** Match `.env` and `.env.<anything>`, single segment, not in EXCLUDE. */
export function isEnvFilename(name: string): name is EnvFileName {
	if (EXCLUDE.has(name)) return false;
	if (name.includes("/") || name.includes("\\")) return false;
	if (name === ".env") return true;
	return name.startsWith(".env.");
}

/** Return absolute paths of `.env*` files directly inside `dir` (non-recursive). */
export async function discoverEnvFiles(dir: AbsPath): Promise<readonly AbsPath[]> {
	const entries = await safeReaddir(dir);
	if (entries.length === 0) return [];

	const out: AbsPath[] = [];
	for (const name of entries) {
		if (!isEnvFilename(name)) continue;
		const full = path.join(dir, name) as AbsPath;
		const isFile = await safeIsFile(full);
		if (!isFile) continue;
		out.push(full);
	}
	out.sort();
	return out;
}

async function safeReaddir(dir: string): Promise<readonly string[]> {
	try {
		return await fs.readdir(dir);
	} catch {
		return [];
	}
}

async function safeIsFile(p: string): Promise<boolean> {
	try {
		const st = await fs.stat(p);
		return st.isFile();
	} catch {
		return false;
	}
}
