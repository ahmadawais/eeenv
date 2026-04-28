import fs from "node:fs/promises";
import path from "node:path";
import type { AbsPath } from "./types.js";
import { ensureDir } from "./vault.js";

/** Byte-copy a file. */
export async function copyByteWise(src: AbsPath, dest: AbsPath): Promise<void> {
	await ensureDir(path.dirname(dest) as AbsPath);
	await fs.copyFile(src, dest);
	await chmodSafe(dest, 0o600);
}

export async function chmodSafe(p: AbsPath, mode: number): Promise<void> {
	try {
		await fs.chmod(p, mode);
	} catch {
		// best-effort; ignore (e.g. read-only filesystem)
	}
}

export async function unlinkIfExists(p: AbsPath): Promise<void> {
	try {
		await fs.unlink(p);
	} catch (e) {
		const code = (e as NodeJS.ErrnoException).code;
		if (code === "ENOENT") return;
		throw e;
	}
}
