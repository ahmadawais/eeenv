import { describe, expect, it } from "vitest";
import { decrypt, encrypt, generateVaultKey } from "../src/lib/crypto.js";

describe("crypto", () => {
	it("round-trips plaintext through encrypt/decrypt", () => {
		const key = generateVaultKey();
		const plain = "STRIPE_KEY=sk_live_supersecret\nDB_URL=postgres://u:p@h/d\n";

		const cipher = encrypt(plain, key);
		expect(cipher).not.toBe(plain);
		expect(cipher).not.toContain("sk_live_supersecret");

		const decrypted = decrypt(cipher, key);
		expect(decrypted).toBe(plain);
	});

	it("fails to decrypt with wrong key", () => {
		const key1 = generateVaultKey();
		const key2 = generateVaultKey();
		const plain = "SECRET=hello";

		const cipher = encrypt(plain, key1);
		expect(() => decrypt(cipher, key2)).toThrow();
	});

	it("generates different ciphertexts for same plaintext", () => {
		const key = generateVaultKey();
		const plain = "SAME=content";

		const c1 = encrypt(plain, key);
		const c2 = encrypt(plain, key);
		expect(c1).not.toBe(c2);
	});

	it("handles empty string", () => {
		const key = generateVaultKey();
		const cipher = encrypt("", key);
		expect(decrypt(cipher, key)).toBe("");
	});

	it("handles unicode", () => {
		const key = generateVaultKey();
		const plain = "EMOJI=🚀🔐\nJAPANESE=日本語\n";
		const cipher = encrypt(plain, key);
		expect(decrypt(cipher, key)).toBe(plain);
	});
});
