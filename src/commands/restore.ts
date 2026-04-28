import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { chmodSafe, unlinkIfExists } from "../lib/fs-ops.js";
import { bold, dim, err, ok, warn } from "../lib/log.js";
import { promptSecret } from "../lib/prompt.js";
import type { AbsPath } from "../lib/types.js";
import {
	decryptFromVault,
	ensureDir,
	getPassphrase,
	readManifest,
	storePassphrase,
	toAbs,
	writeManifest,
} from "../lib/vault.js";

/** Restore real values from the vault back into the project. */
export async function runRestore(cwdRaw: string): Promise<void> {
	const cwd = toAbs(cwdRaw);
	const manifest = await readManifest(cwd);

	const targets = Object.entries(manifest.files);
	if (targets.length === 0) {
		warn("Nothing in the vault for this project.");
		return;
	}

	let passphrase = await getPassphrase();
	if (!passphrase) {
		// Vault is locked — prompt to unlock inline
		// Test bypass: read from env to avoid stdin prompt
		const testPass = process.env.EEENV_TEST_PASSPHRASE;
		const input =
			testPass ?? (await promptSecret("Vault is locked. Enter passphrase to unlock: "));
		if (!input) {
			err("No passphrase provided. Vault remains locked.");
			return;
		}
		passphrase = input;
		await storePassphrase(passphrase);
		ok("Vault unlocked.");
	}

	for (const [rel, entry] of targets) {
		const vaultPath = entry.vaultPath as AbsPath;
		const dest = path.join(cwd, ...rel.split("/")) as AbsPath;

		if (!existsSync(vaultPath)) {
			warn(`${rel}: missing in vault, skipping.`);
			continue;
		}

		let plaintext: string;
		try {
			plaintext = await decryptFromVault(vaultPath, passphrase);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			err(`${rel}: failed to decrypt — ${msg}`);
			return;
		}

		await ensureDir(path.dirname(dest) as AbsPath);
		await unlinkIfExists(dest);
		await fs.writeFile(dest, plaintext, { mode: 0o600 });
		await chmodSafe(dest, 0o600);
		delete manifest.files[rel];
		ok(`restored ${bold(rel)} ← ${dim(vaultPath)}`);
	}

	await writeManifest(cwd, manifest);
}
