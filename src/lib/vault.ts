import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import type { AbsPath, EnvFileName, FileState } from "./types.js";

/** Resolved at call time so tests can override $HOME. */
export function vaultRoot(): AbsPath {
	return path.join(homedir(), ".eeenv", "vault") as AbsPath;
}

const FileStateSchema = z.enum(["hidden"]);

const ManifestEntrySchema = z.object({
	state: FileStateSchema,
	originalPath: z.string().min(1),
	vaultPath: z.string().min(1),
	updatedAt: z.string().min(1),
});

export const ManifestSchema = z.object({
	project: z.string().min(1),
	files: z.record(z.string(), ManifestEntrySchema),
});

export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

/** Coerce a possibly-relative path string to an AbsPath. */
export function toAbs(p: string): AbsPath {
	return path.resolve(p) as AbsPath;
}

/** Vault directory for a given project (project absolute path mirrored under vault root). */
export function vaultDirFor(projectDir: AbsPath): AbsPath {
	const rel = projectDir.replace(/^[/\\]+/, "");
	return path.join(vaultRoot(), rel) as AbsPath;
}

export function manifestPathFor(projectDir: AbsPath): AbsPath {
	return path.join(vaultDirFor(projectDir), ".eeenv.json") as AbsPath;
}

export function vaultPathFor(projectDir: AbsPath, name: EnvFileName): AbsPath {
	return path.join(vaultDirFor(projectDir), name) as AbsPath;
}

export async function ensureDir(dir: AbsPath): Promise<void> {
	await fs.mkdir(dir, { recursive: true });
}

export function emptyManifest(projectDir: AbsPath): Manifest {
	return { project: projectDir, files: {} };
}

export async function readManifest(projectDir: AbsPath): Promise<Manifest> {
	const p = manifestPathFor(projectDir);
	if (!existsSync(p)) return emptyManifest(projectDir);

	const raw = await safeRead(p);
	if (raw === null) return emptyManifest(projectDir);

	const parsed = safeParse(raw);
	if (!parsed) return emptyManifest(projectDir);

	const result = ManifestSchema.safeParse(parsed);
	if (!result.success) return emptyManifest(projectDir);
	return result.data;
}

export async function writeManifest(
	projectDir: AbsPath,
	manifest: Manifest,
): Promise<void> {
	await ensureDir(vaultDirFor(projectDir));
	const validated = ManifestSchema.parse(manifest);
	await fs.writeFile(
		manifestPathFor(projectDir),
		`${JSON.stringify(validated, null, 2)}\n`,
		{ mode: 0o600 },
	);
}

export function buildEntry(args: {
	state: FileState;
	originalPath: AbsPath;
	vaultPath: AbsPath;
}): ManifestEntry {
	return {
		state: args.state,
		originalPath: args.originalPath,
		vaultPath: args.vaultPath,
		updatedAt: new Date().toISOString(),
	};
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
