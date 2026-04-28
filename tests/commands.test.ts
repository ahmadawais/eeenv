import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runHide } from "../src/commands/hide.js";
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
		expect(await readFile(vaultEnv, "utf8")).toBe(ORIGINAL_ENV);

		const manifest = await readManifest(project as AbsPath);
		expect(manifest.files[".env"]?.state).toBe("hidden");

		await runRestore(project);
		expect(await readFileIn(project, ".env")).toBe(ORIGINAL_ENV);

		const after = await readManifest(project as AbsPath);
		expect(Object.keys(after.files)).toEqual([]);
	});

	it("monorepo: hide finds nested .env files and restores them in place", async () => {
		const { project } = ctx.current();

		await writeFileIn(project, ".env", "ROOT=secret-root");
		await mkdir(path.join(project, "apps/web"), { recursive: true });
		await writeFile(path.join(project, "apps/web/.env"), "WEB=secret-web");
		await writeFile(
			path.join(project, "apps/web/.env.production"),
			"WEB_PROD=secret-web-prod",
		);
		await mkdir(path.join(project, "packages/api/src"), { recursive: true });
		await writeFile(path.join(project, "packages/api/.env"), "API=secret-api");

		// Noise that must be skipped
		await mkdir(path.join(project, "node_modules/x"), { recursive: true });
		await writeFile(path.join(project, "node_modules/x/.env"), "NOISE=bad");

		await runHide(project);

		const manifest = await readManifest(project as AbsPath);
		const tracked = Object.keys(manifest.files).sort();
		expect(tracked).toEqual([
			".env",
			"apps/web/.env",
			"apps/web/.env.production",
			"packages/api/.env",
		]);

		// Local files redacted
		const webLocal = await readFile(path.join(project, "apps/web/.env"), "utf8");
		expect(webLocal).not.toContain("secret-web");
		expect(webLocal).toMatch(/^WEB=eeenv_redacted_/m);

		// node_modules untouched
		const noise = await readFile(path.join(project, "node_modules/x/.env"), "utf8");
		expect(noise).toBe("NOISE=bad");

		// Vault mirrors the project tree
		const vaultDir = vaultDirFor(project as AbsPath);
		expect(await readFile(path.join(vaultDir, "apps/web/.env"), "utf8")).toBe(
			"WEB=secret-web",
		);
		expect(await readFile(path.join(vaultDir, "packages/api/.env"), "utf8")).toBe(
			"API=secret-api",
		);

		await runRestore(project);
		expect(await readFile(path.join(project, "apps/web/.env"), "utf8")).toBe(
			"WEB=secret-web",
		);
		expect(await readFile(path.join(project, "packages/api/.env"), "utf8")).toBe(
			"API=secret-api",
		);
		expect(await readFile(path.join(project, ".env"), "utf8")).toBe("ROOT=secret-root");

		const after = await readManifest(project as AbsPath);
		expect(Object.keys(after.files)).toEqual([]);
	});

	it("skipKeys: leaves listed keys un-redacted locally", async () => {
		const { project } = ctx.current();
		await writeFileIn(
			project,
			".eeenv.json",
			JSON.stringify({ skipKeys: ["NUMERIC", "DB_URL"] }),
		);
		await writeFileIn(project, ".env", ORIGINAL_ENV);

		await runHide(project);

		const local = await readFileIn(project, ".env");
		expect(local).not.toContain("sk_live_supersecret");
		expect(local).toMatch(/^STRIPE_KEY=eeenv_redacted_/m);
		// skipped keys keep real values
		expect(local).toContain("NUMERIC=42");
		expect(local).toContain('DB_URL="postgres://u:p@h/d"');

		await runRestore(project);
	});

	it("ignoreFiles: skips matching files entirely", async () => {
		const { project } = ctx.current();
		await writeFileIn(
			project,
			".eeenv.json",
			JSON.stringify({ ignoreFiles: [".env.local", "apps/**"] }),
		);
		await writeFileIn(project, ".env", "ROOT=secret-root");
		await writeFileIn(project, ".env.local", "LOCAL=secret-local");
		await mkdir(path.join(project, "apps/web"), { recursive: true });
		await writeFile(path.join(project, "apps/web/.env"), "WEB=secret-web");
		await mkdir(path.join(project, "packages/api"), { recursive: true });
		await writeFile(path.join(project, "packages/api/.env"), "API=secret-api");

		await runHide(project);

		const manifest = await readManifest(project as AbsPath);
		const tracked = Object.keys(manifest.files).sort();
		// only root .env + api .env; apps/** and .env.local skipped
		expect(tracked).toEqual([".env", "packages/api/.env"]);

		// skipped files keep original content
		expect(await readFileIn(project, ".env.local")).toBe("LOCAL=secret-local");
		expect(await readFile(path.join(project, "apps/web/.env"), "utf8")).toBe(
			"WEB=secret-web",
		);

		await runRestore(project);
	});

	it("discovers .dev.vars files", async () => {
		const { project } = ctx.current();
		await writeFileIn(project, ".dev.vars", "CF_TOKEN=secret-cf");
		await writeFileIn(project, ".dev.vars.example", "CF_TOKEN=dev-cf-template");
		await mkdir(path.join(project, "packages/worker"), { recursive: true });
		await writeFile(
			path.join(project, "packages/worker/.dev.vars"),
			"QUEUE=secret-queue",
		);

		await runHide(project);

		const manifest = await readManifest(project as AbsPath);
		const tracked = Object.keys(manifest.files).sort();
		// .dev.vars discovered at root + nested; .dev.vars.example excluded
		expect(tracked).toEqual([".dev.vars", "packages/worker/.dev.vars"]);

		const local = await readFileIn(project, ".dev.vars");
		expect(local).not.toContain("secret-cf");
		expect(local).toMatch(/^CF_TOKEN=eeenv_redacted_/m);

		// template untouched
		expect(await readFileIn(project, ".dev.vars.example")).toBe(
			"CF_TOKEN=dev-cf-template",
		);

		await runRestore(project);
	});

	it("does nothing when no .env files exist", async () => {
		const { project } = ctx.current();
		await runHide(project);
		const m = await readManifest(project as AbsPath);
		expect(Object.keys(m.files)).toEqual([]);
	});
});
