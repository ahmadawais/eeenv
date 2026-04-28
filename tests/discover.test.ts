import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverEnvFiles, isEnvFilename } from "../src/lib/discover.js";
import type { AbsPath } from "../src/lib/types.js";
import { makeSandbox, writeFileIn } from "./helpers.js";

describe("isEnvFilename", () => {
	it("matches .env and .env.<x> but excludes templates", () => {
		expect(isEnvFilename(".env")).toBe(true);
		expect(isEnvFilename(".env.local")).toBe(true);
		expect(isEnvFilename(".env.production")).toBe(true);
		expect(isEnvFilename(".env.example")).toBe(false);
		expect(isEnvFilename(".env.sample")).toBe(false);
		expect(isEnvFilename(".env.template")).toBe(false);
		expect(isEnvFilename(".env.dist")).toBe(false);
		expect(isEnvFilename("env")).toBe(false);
		expect(isEnvFilename("notes.txt")).toBe(false);
	});
});

describe("discoverEnvFiles", () => {
	it("recursively finds .env* in monorepo layout, ignoring noise dirs", async () => {
		const sb = await makeSandbox();

		// Root + nested envs
		await writeFileIn(sb.project, ".env", "ROOT=1");
		await mkdir(path.join(sb.project, "apps/web"), { recursive: true });
		await writeFile(path.join(sb.project, "apps/web/.env"), "WEB=1");
		await writeFile(path.join(sb.project, "apps/web/.env.local"), "WEB_LOCAL=1");
		await mkdir(path.join(sb.project, "packages/api/src"), { recursive: true });
		await writeFile(path.join(sb.project, "packages/api/.env"), "API=1");

		// Excluded files
		await writeFile(path.join(sb.project, ".env.example"), "");
		await writeFile(path.join(sb.project, "apps/web/.env.template"), "");

		// Noise dirs that must be skipped
		await mkdir(path.join(sb.project, "node_modules/foo"), { recursive: true });
		await writeFile(path.join(sb.project, "node_modules/foo/.env"), "BAD=1");
		await mkdir(path.join(sb.project, "dist"), { recursive: true });
		await writeFile(path.join(sb.project, "dist/.env"), "BAD=1");
		await mkdir(path.join(sb.project, ".git"), { recursive: true });
		await writeFile(path.join(sb.project, ".git/.env"), "BAD=1");
		await mkdir(path.join(sb.project, ".next"), { recursive: true });
		await writeFile(path.join(sb.project, ".next/.env"), "BAD=1");

		const files = await discoverEnvFiles(sb.project as AbsPath);
		const rels = files
			.map((f) => path.relative(sb.project, f).split(path.sep).join("/"))
			.sort();

		expect(rels).toEqual([
			".env",
			"apps/web/.env",
			"apps/web/.env.local",
			"packages/api/.env",
		]);
		await sb.cleanup();
	});

	it("does not follow symlinked directories", async () => {
		const sb = await makeSandbox();
		await writeFileIn(sb.project, ".env", "ROOT=1");

		// outside is a sibling dir holding a .env we should not pick up via symlink
		const outside = path.join(sb.project, "..", "outside");
		await mkdir(outside, { recursive: true });
		await writeFile(path.join(outside, ".env"), "OUTSIDE=1");
		await symlink(outside, path.join(sb.project, "linked"), "dir");

		const files = await discoverEnvFiles(sb.project as AbsPath);
		const rels = files.map((f) => path.relative(sb.project, f));
		expect(rels).toEqual([".env"]);
		await sb.cleanup();
	});

	it("returns empty array for missing dir", async () => {
		const files = await discoverEnvFiles("/nope/definitely/missing" as AbsPath);
		expect(files).toEqual([]);
	});
});
