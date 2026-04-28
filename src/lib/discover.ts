import fs from "node:fs/promises";
import path from "node:path";
import type { AbsPath, EnvFileName } from "./types.js";

const EXCLUDE_FILES: ReadonlySet<string> = new Set([
	".env.example",
	".env.sample",
	".env.template",
	".env.dist",
]);

/**
 * Directories we never recurse into. Standard noise + every common build
 * cache, plus our own vault root if it ever ends up nested inside a project.
 */
const SKIP_DIRS: ReadonlySet<string> = new Set([
	".git",
	".hg",
	".svn",
	"node_modules",
	".pnpm-store",
	".yarn",
	".npm",
	"bower_components",
	"vendor",
	"dist",
	"build",
	"out",
	"output",
	".output",
	".next",
	".nuxt",
	".turbo",
	".cache",
	".parcel-cache",
	".svelte-kit",
	".astro",
	".vercel",
	".netlify",
	".serverless",
	".wrangler",
	".eslintcache",
	".rollup.cache",
	".vite",
	"coverage",
	".nyc_output",
	".eeenv",
	".idea",
	".vscode-test",
	"target",
	"__pycache__",
	".venv",
	"venv",
]);

/** Match `.env` and `.env.<anything>`, single segment, not in EXCLUDE_FILES. */
export function isEnvFilename(name: string): name is EnvFileName {
	if (EXCLUDE_FILES.has(name)) return false;
	if (name.includes("/") || name.includes("\\")) return false;
	if (name === ".env") return true;
	return name.startsWith(".env.");
}

/**
 * Recursively find `.env*` files under `dir`, skipping common noise dirs and
 * symlinks. Returns absolute paths. Never follows symlinked directories.
 */
export async function discoverEnvFiles(dir: AbsPath): Promise<readonly AbsPath[]> {
	const out: AbsPath[] = [];
	await walk(dir, out);
	out.sort();
	return out;
}

async function walk(dir: string, out: AbsPath[]): Promise<void> {
	const entries = await safeReadDir(dir);
	if (entries.length === 0) return;

	for (const ent of entries) {
		const full = path.join(dir, ent.name);

		if (ent.isSymbolicLink()) continue;

		if (ent.isDirectory()) {
			if (SKIP_DIRS.has(ent.name)) continue;
			await walk(full, out);
			continue;
		}

		if (!ent.isFile()) continue;
		if (!isEnvFilename(ent.name)) continue;
		out.push(full as AbsPath);
	}
}

async function safeReadDir(dir: string): Promise<readonly import("node:fs").Dirent[]> {
	try {
		return await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
}
