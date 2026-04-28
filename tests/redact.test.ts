import path from "node:path";
import { describe, expect, it } from "vitest";
import { redactInPlace } from "../src/lib/redact.js";
import type { AbsPath } from "../src/lib/types.js";
import { makeSandbox, readFileIn, writeFileIn } from "./helpers.js";

describe("redactInPlace", () => {
	it("replaces every assignment value but keeps keys, comments, and blanks", async () => {
		const sb = await makeSandbox();
		const original = [
			"# top",
			"STRIPE_KEY=sk_live_supersecret",
			'DB_URL="postgres://u:p@h/d"',
			"export AWS_SECRET=AKIA_FAKE",
			"",
			"# blank above",
			"NUMERIC=42",
		].join("\n");
		await writeFileIn(sb.project, ".env", original);

		const file = path.join(sb.project, ".env") as AbsPath;
		const replaced = await redactInPlace(file);

		const out = await readFileIn(sb.project, ".env");
		expect(replaced).toBe(4);
		expect(out).not.toContain("sk_live_supersecret");
		expect(out).not.toContain("AKIA_FAKE");
		expect(out).not.toContain("postgres://");
		expect(out).toContain("# top");
		expect(out).toContain("# blank above");
		expect(out).toMatch(/^STRIPE_KEY=eeenv_redacted_[0-9a-f]{24}$/m);
		expect(out).toMatch(/^export AWS_SECRET=eeenv_redacted_[0-9a-f]{24}$/m);
		expect(out).toMatch(/^NUMERIC=eeenv_redacted_[0-9a-f]{24}$/m);

		await sb.cleanup();
	});

	it("leaves files with no assignments untouched", async () => {
		const sb = await makeSandbox();
		const original = "# only comments\n\n# nothing here\n";
		await writeFileIn(sb.project, ".env", original);
		const file = path.join(sb.project, ".env") as AbsPath;
		const replaced = await redactInPlace(file);
		expect(replaced).toBe(0);
		expect(await readFileIn(sb.project, ".env")).toBe(original);
		await sb.cleanup();
	});

	it("issues a fresh random token per call (no determinism leak)", async () => {
		const sb = await makeSandbox();
		await writeFileIn(sb.project, ".env", "K=secret1\n");
		const file = path.join(sb.project, ".env") as AbsPath;

		await redactInPlace(file);
		const first = await readFileIn(sb.project, ".env");

		// Re-seed with a fresh real value, then redact again.
		await writeFileIn(sb.project, ".env", "K=secret2\n");
		await redactInPlace(file);
		const second = await readFileIn(sb.project, ".env");

		expect(first).not.toEqual(second);
		await sb.cleanup();
	});
});
