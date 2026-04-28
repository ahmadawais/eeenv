import pc from "picocolors";

export function ok(msg: string): void {
	console.log(`${pc.green("✓")} ${msg}`);
}

export function info(msg: string): void {
	console.log(`${pc.cyan("•")} ${msg}`);
}

export function warn(msg: string): void {
	console.log(`${pc.yellow("!")} ${msg}`);
}

export function err(msg: string): void {
	console.error(`${pc.red("✗")} ${msg}`);
}

export function dim(s: string): string {
	return pc.dim(s);
}

export function bold(s: string): string {
	return pc.bold(s);
}
