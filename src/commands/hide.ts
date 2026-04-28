import path from "node:path";
import ora from "ora";
import { discoverEnvFiles } from "../lib/discover.js";
import { copyByteWise } from "../lib/fs-ops.js";
import { bold, info, ok, warn } from "../lib/log.js";
import { redactInPlace } from "../lib/redact.js";
import type { AbsPath, EnvFileName } from "../lib/types.js";
import {
	buildEntry,
	ensureDir,
	readManifest,
	toAbs,
	vaultDirFor,
	vaultPathFor,
	writeManifest,
} from "../lib/vault.js";

/**
 * Vault real values, then redact local files.
 *
 * Step 1: byte-copy each .env* file to the vault (real values preserved).
 * Step 2: rewrite local file with `KEY=<random-token>` for every assignment.
 *
 * After this, agents reading local .env files see only redacted tokens.
 */
export async function runHide(cwdRaw: string): Promise<void> {
	const cwd = toAbs(cwdRaw);
	const files = await discoverEnvFiles(cwd);
	if (files.length === 0) {
		warn("No .env files found in this directory.");
		return;
	}

	const manifest = await readManifest(cwd);
	await ensureDir(vaultDirFor(cwd));

	const spinner = ora({ text: "Vaulting and redacting…" }).start();

	for (const src of files) {
		const name = path.basename(src) as EnvFileName;
		const dest = vaultPathFor(cwd, name);

		await copyByteWise(src, dest);
		const count = await redactInPlace(src);

		manifest.files[name] = buildEntry({
			state: "hidden",
			originalPath: path.join(cwd, name) as AbsPath,
			vaultPath: dest,
		});

		spinner.stop();
		ok(`hidden ${bold(name)} — vaulted real values, redacted ${count} key(s) locally.`);
		spinner.start();
	}

	spinner.stop();
	await writeManifest(cwd, manifest);
	info(`Run ${bold("eeenv restore")} to put real values back.`);
}
