import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { chmodSafe, unlinkIfExists } from "../lib/fs-ops.js";
import { bold, dim, ok, warn } from "../lib/log.js";
import type { AbsPath } from "../lib/types.js";
import { readManifest, toAbs, writeManifest } from "../lib/vault.js";

/** Restore real values for any files marked `hidden` or `copied`. */
export async function runRestore(cwdRaw: string): Promise<void> {
	const cwd = toAbs(cwdRaw);
	const manifest = await readManifest(cwd);

	const targets = Object.entries(manifest.files);
	if (targets.length === 0) {
		warn("Nothing in the vault for this project.");
		return;
	}

	for (const [name, entry] of targets) {
		const vaultPath = entry.vaultPath as AbsPath;
		const dest = path.join(cwd, name) as AbsPath;

		if (!existsSync(vaultPath)) {
			warn(`${name}: missing in vault, skipping.`);
			continue;
		}

		await unlinkIfExists(dest);
		await fs.copyFile(vaultPath, dest);
		await chmodSafe(dest, 0o600);
		delete manifest.files[name];
		ok(`restored ${bold(name)} ← ${dim(vaultPath)}`);
	}

	await writeManifest(cwd, manifest);
}
