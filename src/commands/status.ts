import pc from "picocolors";
import { discoverEnvFiles } from "../lib/discover.js";
import { bold, dim } from "../lib/log.js";
import { readManifest, relFromProject, toAbs, vaultDirFor } from "../lib/vault.js";

/** Show what eeenv is tracking for this project. */
export async function runStatus(cwdRaw: string): Promise<void> {
	const cwd = toAbs(cwdRaw);
	const manifest = await readManifest(cwd);

	console.log(bold(`Project: ${pc.cyan(cwd)}`));
	console.log(dim(`Vault:   ${vaultDirFor(cwd)}`));

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

	const local = await discoverEnvFiles(cwd);
	const untracked = local
		.map((f) => relFromProject(cwd, f))
		.filter((rel) => !(rel in manifest.files));
	if (untracked.length === 0) return;

	console.log("");
	console.log(dim("Untracked .env files:"));
	for (const rel of untracked) console.log(`  ${dim("·")} ${rel}`);
}
