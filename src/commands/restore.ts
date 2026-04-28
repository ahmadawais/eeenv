import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { chmodSafe, unlinkIfExists } from "../lib/fs-ops.js";
import { bold, dim, ok, warn } from "../lib/log.js";
import type { AbsPath } from "../lib/types.js";
import { ensureDir, readManifest, toAbs, writeManifest } from "../lib/vault.js";

/** Restore real values from the vault back into the project. */
export async function runRestore(cwdRaw: string): Promise<void> {
	const cwd = toAbs(cwdRaw);
	const manifest = await readManifest(cwd);

	const targets = Object.entries(manifest.files);
	if (targets.length === 0) {
		warn("Nothing in the vault for this project.");
		return;
	}

	for (const [rel, entry] of targets) {
		const vaultPath = entry.vaultPath as AbsPath;
		const dest = path.join(cwd, ...rel.split("/")) as AbsPath;

		if (!existsSync(vaultPath)) {
			warn(`${rel}: missing in vault, skipping.`);
			continue;
		}

		await ensureDir(path.dirname(dest) as AbsPath);
		await unlinkIfExists(dest);
		await fs.copyFile(vaultPath, dest);
		await chmodSafe(dest, 0o600);
		delete manifest.files[rel];
		ok(`restored ${bold(rel)} ← ${dim(vaultPath)}`);
	}

	await writeManifest(cwd, manifest);
}
