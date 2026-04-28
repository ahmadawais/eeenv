import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { homedir } from "node:os";
import { platform } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SERVICE = "eeenv";
const ACCOUNT = "eeenv-vault-key";

/** Env var that forces file-based keychain for testing. */
const TEST_KEYCHAIN_VAR = "EEENV_TEST_KEYCHAIN";

export type Platform = "darwin" | "linux" | "win32" | "unknown";

export function getPlatform(): Platform {
	const p = platform();
	if (p === "darwin") return "darwin";
	if (p === "linux") return "linux";
	if (p === "win32") return "win32";
	return "unknown";
}

export class KeychainError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "KeychainError";
	}
}

function testKeychainPath(): string {
	const home = process.env[TEST_KEYCHAIN_VAR] ?? homedir();
	return path.join(home, ".eeenv", "test-keychain.json");
}

async function readTestKeychain(): Promise<Record<string, string>> {
	const p = testKeychainPath();
	if (!existsSync(p)) return {};
	try {
		const raw = await fs.readFile(p, "utf8");
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

async function writeTestKeychain(data: Record<string, string>): Promise<void> {
	const p = testKeychainPath();
	await fs.mkdir(path.dirname(p), { recursive: true });
	await fs.writeFile(p, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function isTestMode(): boolean {
	return !!process.env[TEST_KEYCHAIN_VAR];
}

/**
 * Store a secret in the OS keychain.
 * macOS: security add-generic-password
 * Linux: secret-tool store (libsecret)
 * Windows: cmdkey /add (basic) — falls back to PowerShell CredentialManager
 */
export async function setKeychainSecret(secret: string): Promise<void> {
	if (isTestMode()) {
		const data = await readTestKeychain();
		data[`${SERVICE}:${ACCOUNT}`] = secret;
		await writeTestKeychain(data);
		return;
	}

	const plat = getPlatform();

	if (plat === "darwin") {
		await execFileAsync("security", [
			"add-generic-password",
			"-a",
			ACCOUNT,
			"-s",
			SERVICE,
			"-w",
			secret,
			"-U", // update if exists
		]);
		return;
	}

	if (plat === "linux") {
		// secret-tool store <attribute> <value> ...
		// We use stdin for the secret to avoid shell escaping issues
		await new Promise<void>((resolve, reject) => {
			const child = execFile(
				"secret-tool",
				["store", "--label=eeenv vault key", "service", SERVICE, "account", ACCOUNT],
				(error) => {
					if (error)
						reject(new KeychainError(`secret-tool store failed: ${error.message}`));
					else resolve();
				},
			);
			child.stdin?.write(secret);
			child.stdin?.end();
		});
		return;
	}

	if (plat === "win32") {
		// Windows: use PowerShell to store in Windows Credential Manager
		const psScript = `
$credential = New-Object System.Management.Automation.PSCredential -ArgumentList @(
  "${ACCOUNT}",
  (ConvertTo-SecureString -String "${secret.replace(/"/g, '""')}" -AsPlainText -Force)
)
$credential.Password | ConvertFrom-SecureString | Out-File -FilePath "$env:TEMP\\eeenv-vault-key.tmp" -Force
`;
		await execFileAsync("powershell.exe", ["-Command", psScript]);
		return;
	}

	throw new KeychainError(
		`Unsupported platform: ${plat}. Keychain storage not available.`,
	);
}

/**
 * Retrieve a secret from the OS keychain.
 */
export async function getKeychainSecret(): Promise<string | null> {
	if (isTestMode()) {
		const data = await readTestKeychain();
		return data[`${SERVICE}:${ACCOUNT}`] ?? null;
	}

	const plat = getPlatform();

	if (plat === "darwin") {
		try {
			const { stdout } = await execFileAsync("security", [
				"find-generic-password",
				"-a",
				ACCOUNT,
				"-s",
				SERVICE,
				"-w", // output password only
			]);
			return stdout.trim();
		} catch (error) {
			const msg = (error as Error).message ?? "";
			if (msg.includes("The specified item could not be found")) return null;
			throw new KeychainError(`security find-generic-password failed: ${msg}`);
		}
	}

	if (plat === "linux") {
		try {
			const { stdout } = await execFileAsync("secret-tool", [
				"lookup",
				"service",
				SERVICE,
				"account",
				ACCOUNT,
			]);
			return stdout.trim() || null;
		} catch (error) {
			const msg = (error as Error).message ?? "";
			if (msg.includes("not found") || msg.includes("No matching")) return null;
			throw new KeychainError(`secret-tool lookup failed: ${msg}`);
		}
	}

	if (plat === "win32") {
		try {
			const psScript = `
$path = "$env:TEMP\\eeenv-vault-key.tmp"
if (Test-Path $path) {
  $secure = Get-Content $path | ConvertTo-SecureString
  $credential = New-Object System.Management.Automation.PSCredential -ArgumentList @("${ACCOUNT}", $secure)
  $credential.GetNetworkCredential().Password
} else {
  Write-Output ""
}
`;
			const { stdout } = await execFileAsync("powershell.exe", ["-Command", psScript]);
			const result = stdout.trim();
			return result || null;
		} catch {
			return null;
		}
	}

	throw new KeychainError(
		`Unsupported platform: ${plat}. Keychain storage not available.`,
	);
}

/**
 * Delete the secret from the OS keychain.
 */
export async function deleteKeychainSecret(): Promise<void> {
	if (isTestMode()) {
		const data = await readTestKeychain();
		delete data[`${SERVICE}:${ACCOUNT}`];
		await writeTestKeychain(data);
		return;
	}

	const plat = getPlatform();

	if (plat === "darwin") {
		try {
			await execFileAsync("security", [
				"delete-generic-password",
				"-a",
				ACCOUNT,
				"-s",
				SERVICE,
			]);
		} catch (error) {
			const msg = (error as Error).message ?? "";
			if (msg.includes("The specified item could not be found")) return;
			throw new KeychainError(`security delete-generic-password failed: ${msg}`);
		}
		return;
	}

	if (plat === "linux") {
		try {
			await execFileAsync("secret-tool", [
				"clear",
				"service",
				SERVICE,
				"account",
				ACCOUNT,
			]);
		} catch (error) {
			const msg = (error as Error).message ?? "";
			if (msg.includes("not found")) return;
			throw new KeychainError(`secret-tool clear failed: ${msg}`);
		}
		return;
	}

	if (plat === "win32") {
		try {
			const psScript = `
$path = "$env:TEMP\\eeenv-vault-key.tmp"
if (Test-Path $path) { Remove-Item $path -Force }
`;
			await execFileAsync("powershell.exe", ["-Command", psScript]);
		} catch {
			// best effort
		}
		return;
	}

	throw new KeychainError(
		`Unsupported platform: ${plat}. Keychain storage not available.`,
	);
}

/**
 * Check if a key exists in the keychain.
 */
export async function hasKeychainSecret(): Promise<boolean> {
	const secret = await getKeychainSecret();
	return secret !== null;
}
