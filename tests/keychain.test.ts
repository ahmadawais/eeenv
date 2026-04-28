import { describe, expect, it } from "vitest";
import {
	deleteKeychainSecret,
	getKeychainSecret,
	hasKeychainSecret,
	setKeychainSecret,
} from "../src/lib/keychain.js";

describe("keychain (test mode)", () => {
	it("stores and retrieves a secret", async () => {
		await setKeychainSecret("my-secret-key");
		const retrieved = await getKeychainSecret();
		expect(retrieved).toBe("my-secret-key");
	});

	it("returns null when no secret exists", async () => {
		await deleteKeychainSecret();
		const retrieved = await getKeychainSecret();
		expect(retrieved).toBeNull();
	});

	it("hasKeychainSecret reflects existence", async () => {
		await deleteKeychainSecret();
		expect(await hasKeychainSecret()).toBe(false);

		await setKeychainSecret("test-key");
		expect(await hasKeychainSecret()).toBe(true);
	});

	it("updates an existing secret", async () => {
		await setKeychainSecret("old-key");
		await setKeychainSecret("new-key");
		expect(await getKeychainSecret()).toBe("new-key");
	});
});
