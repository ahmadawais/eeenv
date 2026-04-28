import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

export type Sandbox = {
	project: string;
	home: string;
	cleanup: () => Promise<void>;
};

/** Make an isolated project dir AND override $HOME so the vault is sandboxed. */
export async function makeSandbox(): Promise<Sandbox> {
	const root = await mkdtemp(path.join(tmpdir(), "eeenv-test-"));
	// Resolve through symlinks so /private/var/... matches process.cwd().
	const realRoot = await realpath(root);
	const project = path.join(realRoot, "proj");
	const home = path.join(realRoot, "home");
	await mkdir(project, { recursive: true });
	await mkdir(home, { recursive: true });
	return {
		project,
		home,
		cleanup: () => rm(realRoot, { recursive: true, force: true }),
	};
}

export async function writeFileIn(
	dir: string,
	name: string,
	content: string,
): Promise<void> {
	await writeFile(path.join(dir, name), content, "utf8");
}

export async function readFileIn(dir: string, name: string): Promise<string> {
	return readFile(path.join(dir, name), "utf8");
}

const HOME_KEY = "HOME";

/** Test hook that sets $HOME for each test and restores after. */
export function withSandboxHome(): { current: () => Sandbox } {
	let sandbox: Sandbox;
	let prevHome: string | undefined;
	beforeEach(async () => {
		sandbox = await makeSandbox();
		prevHome = process.env[HOME_KEY];
		process.env[HOME_KEY] = sandbox.home;
	});
	afterEach(async () => {
		// Assigning undefined deletes the key in Node's env proxy.
		process.env[HOME_KEY] = prevHome;
		await sandbox.cleanup();
	});
	return { current: () => sandbox };
}

async function realpath(p: string): Promise<string> {
	const { realpath: rp } = await import("node:fs/promises");
	return rp(p);
}
