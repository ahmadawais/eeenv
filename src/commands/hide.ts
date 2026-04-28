import path from "node:path";
import ora from "ora";
import { discoverEnvFiles } from "../lib/discover.js";
import { copyByteWise } from "../lib/fs-ops.js";
import { bold, info, ok, warn } from "../lib/log.js";
import { redactInPlace } from "../lib/redact.js";
import type { AbsPath } from "../lib/types.js";
import {
	buildEntry,
	ensureDir,
	readManifest,
	relFromProject,
	toAbs,
	vaultDirFor,
	vaultPathFor,
	writeManifest,
} from "../lib/vault.js";

/**
 * Vault real values, then redact local files.
 *
 * Walks the project recursively (skipping node_modules, .git, build dirs, etc.),
 * byte-copies each .env* into the vault under its project-relative path, then
 * rewrites the local file with `KEY=<random-token>` for every assignment.
 */
export async function runHide(cwdRaw: string): Promise<void> {
	const cwd = toAbs(cwdRaw);
	const files = await discoverEnvFiles(cwd);
	if (files.length === 0) {
		warn("No .env files found in this project.");
		return;
	}

	const manifest = await readManifest(cwd);
	await ensureDir(vaultDirFor(cwd));

	const spinner = ora({ text: "Vaulting and redacting…" }).start();

	for (const src of files) {
		const rel = relFromProject(cwd, src);
		const dest = vaultPathFor(cwd, rel);
		await ensureDir(path.dirname(dest) as AbsPath);

		await copyByteWise(src, dest);
		const count = await redactInPlace(src);

		manifest.files[rel] = buildEntry({
			state: "hidden",
			originalPath: src,
			vaultPath: dest,
		});

		spinner.stop();
		ok(`hidden ${bold(rel)} — vaulted real values, redacted ${count} key(s) locally.`);
		spinner.start();
	}

	spinner.stop();
	await writeManifest(cwd, manifest);
	info(`Run ${bold("eeenv restore")} to put real values back.`);
}
