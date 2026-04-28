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
	it("finds matching files in a project directory", async () => {
		const sb = await makeSandbox();
		await writeFileIn(sb.project, ".env", "A=1");
		await writeFileIn(sb.project, ".env.local", "B=2");
		await writeFileIn(sb.project, ".env.example", "A=");
		await writeFileIn(sb.project, "README.md", "hi");

		const files = await discoverEnvFiles(sb.project as AbsPath);
		const names = files.map((f) => path.basename(f)).sort();
		expect(names).toEqual([".env", ".env.local"]);
		await sb.cleanup();
	});

	it("returns empty array for missing dir", async () => {
		const files = await discoverEnvFiles("/nope/definitely/missing" as AbsPath);
		expect(files).toEqual([]);
	});
});
