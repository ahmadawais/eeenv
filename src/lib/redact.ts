import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import type { AbsPath } from "./types.js";

const ASSIGNMENT = /^(\s*)(export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

/**
 * Rewrite an env file replacing every value with a random redacted token.
 *
 * Preserves: comments, blank lines, `export ` prefix, key names.
 * Replaces: everything to the right of `=` on assignment lines.
 *
 * Keys listed in `skip` keep their real values locally (useful for
 * non-sensitive vars like `NODE_ENV`). The full file is still vaulted.
 *
 * The original value bytes are read off disk in order to discard them, but
 * are never inspected, logged, or returned. Each redacted value gets a
 * fresh random token so secret length / entropy isn't leaked either.
 */
export async function redactInPlace(
	filePath: AbsPath,
	skip: readonly string[] = [],
): Promise<number> {
	const skipSet = new Set(skip);
	const content = await fs.readFile(filePath, "utf8");
	const lines = content.split(/\r?\n/);

	let replaced = 0;
	const out = lines.map((line) => {
		const next = redactLine(line, skipSet);
		if (next !== line) replaced += 1;
		return next;
	});

	await fs.writeFile(filePath, out.join("\n"), { mode: 0o600 });
	return replaced;
}

function redactLine(line: string, skip: ReadonlySet<string>): string {
	const trimmed = line.trimStart();
	if (trimmed === "" || trimmed.startsWith("#")) return line;

	const m = ASSIGNMENT.exec(line);
	if (!m) return line;

	const leading = m[1] ?? "";
	const exp = m[2] ?? "";
	const key = m[3] ?? "";

	if (skip.has(key)) return line;

	const token = `eeenv_redacted_${randomBytes(12).toString("hex")}`;
	return `${leading}${exp}${key}=${token}`;
}
