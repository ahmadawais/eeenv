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
 * The original value bytes are read off disk in order to discard them, but
 * are never inspected, logged, or returned. Each value is replaced with a
 * fresh random token so secret length / entropy isn't leaked either.
 */
export async function redactInPlace(filePath: AbsPath): Promise<number> {
	const content = await fs.readFile(filePath, "utf8");
	const lines = content.split(/\r?\n/);

	let replaced = 0;
	const out = lines.map((line) => {
		const next = redactLine(line);
		if (next !== line) replaced += 1;
		return next;
	});

	await fs.writeFile(filePath, out.join("\n"), { mode: 0o600 });
	return replaced;
}

function redactLine(line: string): string {
	const trimmed = line.trimStart();
	if (trimmed === "" || trimmed.startsWith("#")) return line;

	const m = ASSIGNMENT.exec(line);
	if (!m) return line;

	const leading = m[1] ?? "";
	const exp = m[2] ?? "";
	const key = m[3] ?? "";
	const token = `eeenv_redacted_${randomBytes(12).toString("hex")}`;
	return `${leading}${exp}${key}=${token}`;
}
