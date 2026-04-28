import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Derive a 256-bit key from a passphrase using scrypt.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
	return scryptSync(passphrase, salt, KEY_LENGTH);
}

/**
 * Encrypt plaintext with AES-256-GCM.
 *
 * Format: base64( salt(32) + iv(16) + authTag(16) + ciphertext )
 *
 * The salt is used with scrypt to derive the key from the passphrase.
 */
export function encrypt(plaintext: string, passphrase: string): string {
	const salt = randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);
	const key = deriveKey(passphrase, salt);

	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();

	const combined = Buffer.concat([salt, iv, authTag, encrypted]);
	return combined.toString("base64");
}

/**
 * Decrypt ciphertext encrypted with `encrypt()`.
 *
 * Throws if the auth tag fails verification (tampered ciphertext).
 */
export function decrypt(ciphertext: string, passphrase: string): string {
	const combined = Buffer.from(ciphertext, "base64");

	if (combined.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
		throw new Error("Invalid ciphertext: too short");
	}

	const salt = combined.subarray(0, SALT_LENGTH);
	const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
	const authTag = combined.subarray(
		SALT_LENGTH + IV_LENGTH,
		SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH,
	);
	const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

	const key = deriveKey(passphrase, salt);
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
	return decrypted.toString("utf8");
}

/**
 * Generate a random 256-bit passphrase (32 bytes, base64 = 44 chars).
 * This is the vault encryption key stored in the keychain.
 */
export function generateVaultKey(): string {
	return randomBytes(32).toString("base64");
}
