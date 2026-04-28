import { describe, expect, it } from "vitest";
import { DEFAULT_IGNORE, readProjectConfig, shouldIgnore } from "../src/lib/config.js";
import type { AbsPath } from "../src/lib/types.js";
import { makeSandbox, writeFileIn } from "./helpers.js";

describe("readProjectConfig", () => {
	it("returns defaults when no .eeenv.json exists", async () => {
		const sb = await makeSandbox();
		const cfg = await readProjectConfig(sb.project as AbsPath);
		expect(cfg.skipKeys).toEqual([]);
		expect(cfg.ignoreFiles).toEqual([...DEFAULT_IGNORE]);
		await sb.cleanup();
	});

	it("parses skipKeys and ignoreFiles", async () => {
		const sb = await makeSandbox();
		await writeFileIn(
			sb.project,
			".eeenv.json",
			JSON.stringify({
				skipKeys: ["DEBUG", "PORT"],
				ignoreFiles: [".env.local", "packages/*/.env"],
			}),
		);
		const cfg = await readProjectConfig(sb.project as AbsPath);
		expect(cfg.skipKeys).toEqual(["DEBUG", "PORT"]);
		expect(cfg.ignoreFiles).toEqual([".env.local", "packages/*/.env"]);
		await sb.cleanup();
	});

	it("returns defaults for invalid JSON", async () => {
		const sb = await makeSandbox();
		await writeFileIn(sb.project, ".eeenv.json", "not json");
		const cfg = await readProjectConfig(sb.project as AbsPath);
		expect(cfg.skipKeys).toEqual([]);
		expect(cfg.ignoreFiles).toEqual([...DEFAULT_IGNORE]);
		await sb.cleanup();
	});
});

describe("shouldIgnore", () => {
	it("matches filenames anywhere in the tree", () => {
		expect(shouldIgnore(".env.local", [".env.local"])).toBe(true);
		expect(shouldIgnore("apps/web/.env.local", [".env.local"])).toBe(true);
		expect(shouldIgnore("apps/web/.env", [".env.local"])).toBe(false);
	});

	it("matches glob patterns", () => {
		const patterns = ["packages/*/.env"];
		expect(shouldIgnore("packages/api/.env", patterns)).toBe(true);
		expect(shouldIgnore("packages/worker/.env", patterns)).toBe(true);
		expect(shouldIgnore("apps/web/.env", patterns)).toBe(false);
		expect(shouldIgnore("packages/api/.env.local", patterns)).toBe(false);
	});

	it("returns false for empty patterns", () => {
		expect(shouldIgnore("anything", [])).toBe(false);
	});
});
