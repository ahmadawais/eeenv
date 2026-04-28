import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCopy } from "../src/commands/copy.js";
import { runGlobal } from "../src/commands/global.js";
import { runHide } from "../src/commands/hide.js";
import { runLocal } from "../src/commands/local.js";
import { runRestore } from "../src/commands/restore.js";
import type { AbsPath } from "../src/lib/types.js";
import { readManifest, vaultDirFor } from "../src/lib/vault.js";
import { readFileIn, withSandboxHome, writeFileIn } from "./helpers.js";

const ORIGINAL_ENV = [
	"# top",
	"STRIPE_KEY=sk_live_supersecret",
	'DB_URL="postgres://u:p@h/d"',
	"NUMERIC=42",
].join("\n");

describe("eeenv commands (end-to-end)", () => {
	const ctx = withSandboxHome();

	it("hide → vaults real values and redacts locally; restore brings them back", async () => {
		const { project } = ctx.current();
		await writeFileIn(project, ".env", ORIGINAL_ENV);

		await runHide(project);

		const local = await readFileIn(project, ".env");
		expect(local).not.toContain("sk_live_supersecret");
		expect(local).toContain("# top");
		expect(local).toMatch(/^STRIPE_KEY=eeenv_redacted_/m);

		const vaultDir = vaultDirFor(project as AbsPath);
		const vaultEnv = path.join(vaultDir, ".env");
		expect(existsSync(vaultEnv)).toBe(true);
		const vaulted = await import("node:fs/promises").then((m) =>
			m.readFile(vaultEnv, "utf8"),
		);
		expect(vaulted).toBe(ORIGINAL_ENV);

		const manifest = await readManifest(project as AbsPath);
		expect(manifest.files[".env"]?.state).toBe("hidden");

		await runRestore(project);
		expect(await readFileIn(project, ".env")).toBe(ORIGINAL_ENV);

		const after = await readManifest(project as AbsPath);
		expect(Object.keys(after.files)).toEqual([]);
	});

	it("global → moves files out; local → moves them back", async () => {
		const { project } = ctx.current();
		await writeFileIn(project, ".env", ORIGINAL_ENV);
		await writeFileIn(project, ".env.local", "X=1\n");

		await runGlobal(project);
		expect(existsSync(path.join(project, ".env"))).toBe(false);
		expect(existsSync(path.join(project, ".env.local"))).toBe(false);

		const vaultDir = vaultDirFor(project as AbsPath);
		expect(existsSync(path.join(vaultDir, ".env"))).toBe(true);
		expect(existsSync(path.join(vaultDir, ".env.local"))).toBe(true);

		const m1 = await readManifest(project as AbsPath);
		expect(m1.files[".env"]?.state).toBe("moved");

		await runLocal(project);
		expect(await readFileIn(project, ".env")).toBe(ORIGINAL_ENV);
		expect(await readFileIn(project, ".env.local")).toBe("X=1\n");
		expect(existsSync(path.join(vaultDir, ".env"))).toBe(false);

		const m2 = await readManifest(project as AbsPath);
		expect(Object.keys(m2.files)).toEqual([]);
	});

	it("copy → leaves originals intact and stores a vault copy", async () => {
		const { project } = ctx.current();
		await writeFileIn(project, ".env", ORIGINAL_ENV);

		await runCopy(project);

		expect(existsSync(path.join(project, ".env"))).toBe(true);
		expect(await readFileIn(project, ".env")).toBe(ORIGINAL_ENV);

		const vaultDir = vaultDirFor(project as AbsPath);
		expect(existsSync(path.join(vaultDir, ".env"))).toBe(true);

		const m = await readManifest(project as AbsPath);
		expect(m.files[".env"]?.state).toBe("copied");
	});

	it("does nothing when no .env files exist", async () => {
		const { project } = ctx.current();
		await runHide(project);
		await runGlobal(project);
		await runCopy(project);
		const m = await readManifest(project as AbsPath);
		expect(Object.keys(m.files)).toEqual([]);
	});
});
