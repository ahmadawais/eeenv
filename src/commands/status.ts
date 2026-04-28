import pc from "picocolors";
import { readProjectConfig, shouldIgnore } from "../lib/config.js";
import { discoverEnvFiles } from "../lib/discover.js";
import { bold, dim, info } from "../lib/log.js";
import {
	isVaultUnlocked,
	readManifest,
	relFromProject,
	toAbs,
	vaultDirFor,
} from "../lib/vault.js";

/** Show what eeenv is tracking / would touch for this project. */
export async function runStatus(cwdRaw: string): Promise<void> {
	const cwd = toAbs(cwdRaw);
	const manifest = await readManifest(cwd);
	const config = await readProjectConfig(cwd);
	const hasPassphrase = await isVaultUnlocked();

	console.log(bold(`Project: ${pc.cyan(cwd)}`));
	console.log(dim(`Vault:   ${vaultDirFor(cwd)}`));

	const keychainStatus = hasPassphrase
		? pc.green("passphrase in keychain")
		: pc.red("no passphrase in keychain");
	console.log(dim(`Keychain: ${keychainStatus}`));

	const entries = Object.entries(manifest.files);
	if (entries.length === 0) {
		console.log(dim("Nothing tracked."));
	} else {
		console.log("");
		for (const [rel, entry] of entries) {
			console.log(
				`  ${pc.magenta("hidden")} ${bold(rel)} ${dim(`(${entry.updatedAt})`)}`,
			);
		}
	}

	const all = await discoverEnvFiles(cwd);
	const allRel = all.map((f) => relFromProject(cwd, f));
	const ignored = allRel.filter((f) => shouldIgnore(f, config.ignoreFiles));
	const untracked = allRel.filter(
		(f) => !(f in manifest.files) && !shouldIgnore(f, config.ignoreFiles),
	);

	if (untracked.length > 0) {
		console.log("");
		console.log(dim("Untracked env files:"));
		for (const rel of untracked) console.log(`  ${dim("·")} ${rel}`);
	} else if (allRel.length === 0) {
		console.log("");
		info("No .env / .dev.vars files found in this project.");
	}

	if (ignored.length > 0) {
		console.log("");
		console.log(dim("Skipped via .eeenv.json ignoreFiles:"));
		for (const rel of ignored) console.log(`  ${dim("·")} ${rel}`);
	}
}
