import path from "node:path";
import pc from "picocolors";
import { discoverEnvFiles } from "../lib/discover.js";
import { bold, dim } from "../lib/log.js";
import { readManifest, toAbs, vaultDirFor } from "../lib/vault.js";

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
		for (const [name, entry] of entries) {
			console.log(
				`  ${pc.magenta("hidden")} ${bold(name)} ${dim(`(${entry.updatedAt})`)}`,
			);
		}
	}

	const local = await discoverEnvFiles(cwd);
	const untracked = local.filter((f) => !(path.basename(f) in manifest.files));
	if (untracked.length === 0) return;

	console.log("");
	console.log(dim("Untracked local .env files:"));
	for (const f of untracked) console.log(`  ${dim("·")} ${path.basename(f)}`);
}

function stateColor(state: "moved" | "copied" | "hidden"): string {
	const padded = state.padEnd(7);
	if (state === "moved") return pc.yellow(padded);
	if (state === "hidden") return pc.magenta(padded);
	return pc.cyan(padded);
}
