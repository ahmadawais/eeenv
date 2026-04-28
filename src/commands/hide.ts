import path from "node:path";
import ora from "ora";
import { readProjectConfig, shouldIgnore } from "../lib/config.js";
import { discoverEnvFiles } from "../lib/discover.js";
import { bold, err, info, ok, warn } from "../lib/log.js";
import { promptSecret } from "../lib/prompt.js";
import { redactInPlace } from "../lib/redact.js";
import type { AbsPath } from "../lib/types.js";
import {
	buildEntry,
	encryptToVault,
	ensureDir,
	getPassphrase,
	readManifest,
	relFromProject,
	storePassphrase,
	toAbs,
	vaultDirFor,
	vaultPathFor,
	writeManifest,
} from "../lib/vault.js";

const REDACTED_PATTERN = /eeenv_redacted_[a-f0-9]{22,}/;

/**
 * Vault real values (encrypted), then redact local files.
 *
 * Walks the project recursively (skipping node_modules, .git, build dirs, etc.),
 * encrypts each .env* / .dev.vars* into the vault under its project-relative
 * path, then rewrites the local file with `KEY=<random-token>` for every
 * assignment — except keys listed in `.eeenv.json` `skipKeys`.
 *
 * Files matching globs in `ignoreFiles` are skipped entirely (no vault, no redact).
 */
export async function runHide(cwdRaw: string): Promise<void> {
	const cwd = toAbs(cwdRaw);
	const cfg = await readProjectConfig(cwd);
	const allFiles = await discoverEnvFiles(cwd);

	if (allFiles.length === 0) {
		warn("No .env / .dev.vars files found in this project.");
		return;
	}

	let skipped = 0;
	const files: AbsPath[] = [];
	for (const f of allFiles) {
		if (shouldIgnore(relFromProject(cwd, f), cfg.ignoreFiles)) {
			skipped++;
			continue;
		}
		files.push(f);
	}

	if (skipped > 0) info(`Skipped ${skipped} file(s) matched by ignoreFiles.`);

	if (files.length === 0) {
		warn("All discovered files were skipped. Nothing to hide.");
		return;
	}

	const manifest = await readManifest(cwd);

	// Guard against double-hide: refuse to vault files that are already redacted
	const alreadyRedacted: string[] = [];
	const alreadyTracked: string[] = [];
	for (const src of files) {
		const rel = relFromProject(cwd, src);
		if (rel in manifest.files) {
			alreadyTracked.push(rel);
			continue;
		}
		const content = await fsReadFile(src, "utf8").catch(() => "");
		if (REDACTED_PATTERN.test(content)) {
			alreadyRedacted.push(rel);
		}
	}

	if (alreadyTracked.length > 0 || alreadyRedacted.length > 0) {
		err("Cannot hide — some files appear to already be redacted:");
		for (const rel of alreadyTracked) {
			console.log(`  ${bold(rel)} — already tracked in vault (run eeenv restore first)`);
		}
		for (const rel of alreadyRedacted) {
			console.log(`  ${bold(rel)} — contains redacted tokens (run eeenv restore first)`);
		}
		return;
	}

	await ensureDir(vaultDirFor(cwd));

	// Ensure we have a passphrase in the keychain
	let passphrase = await getPassphrase();
	if (!passphrase) {
		const p1 = await promptSecret("Set a vault passphrase: ");
		if (!p1) {
			warn("Passphrase cannot be empty. Aborting.");
			return;
		}
		const p2 = await promptSecret("Confirm passphrase: ");
		if (p1 !== p2) {
			warn("Passphrases do not match. Aborting.");
			return;
		}
		passphrase = p1;
		await storePassphrase(passphrase);
		ok("Passphrase saved to OS keychain.");
	}

	const spinner = ora({ text: "Vaulting and redacting…" }).start();

	for (const src of files) {
		const rel = relFromProject(cwd, src);
		const dest = vaultPathFor(cwd, rel);

		await encryptToVault(src, dest, passphrase);
		const count = await redactInPlace(src, cfg.skipKeys);

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

async function fsReadFile(p: string, enc: "utf8"): Promise<string> {
	const { readFile } = await import("node:fs/promises");
	return readFile(p, enc);
}
