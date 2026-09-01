import { describe, it, expect } from "vitest";
import { constantTimeEqual } from "../server/utils/timingSafe";
import { assertTargetInWebDavScope } from "../server/albumWebdavEnv";
import { verifyAlbumAccess, verifyAlbumPassword } from "../utils/albumAuth";

describe("constantTimeEqual", () => {
	it("returns true for identical strings", () => {
		expect(constantTimeEqual("secret", "secret")).toBe(true);
	});

	it("returns false for differing strings of equal length", () => {
		expect(constantTimeEqual("secret", "secres")).toBe(false);
	});

	it("returns false for differing lengths", () => {
		expect(constantTimeEqual("secret", "secre")).toBe(false);
		expect(constantTimeEqual("a", "")).toBe(false);
	});

	it("handles empty strings", () => {
		expect(constantTimeEqual("", "")).toBe(true);
	});
});

describe("verifyAlbumAccess", () => {
	it("allows access when not encrypted", () => {
		expect(verifyAlbumAccess({ encrypted: false })).toBe(true);
		expect(verifyAlbumAccess({})).toBe(true);
	});

	it("rejects when encrypted but no configured password", () => {
		expect(verifyAlbumAccess({ encrypted: true, password: "" })).toBe(false);
	});

	it("rejects wrong password", () => {
		expect(
			verifyAlbumAccess({
				encrypted: true,
				password: "correct",
				accessPassword: "wrong",
			}),
		).toBe(false);
	});

	it("accepts correct password", () => {
		expect(
			verifyAlbumAccess({
				encrypted: true,
				password: "correct",
				accessPassword: "correct",
			}),
		).toBe(true);
	});
});

describe("verifyAlbumPassword", () => {
	it("rejects when no configured password", () => {
		expect(verifyAlbumPassword("x", undefined)).toBe(false);
	});

	it("compares in constant time", () => {
		expect(verifyAlbumPassword("pw", "pw")).toBe(true);
		expect(verifyAlbumPassword("pw", "pwx")).toBe(false);
	});
});

describe("assertTargetInWebDavScope", () => {
	it("allows exact base path", () => {
		expect(() =>
			assertTargetInWebDavScope("https://webdav.example.com/album/", "https://webdav.example.com/album/"),
		).not.toThrow();
	});

	it("allows file under base path", () => {
		expect(() =>
			assertTargetInWebDavScope(
				"https://webdav.example.com/album/photo.jpg",
				"https://webdav.example.com/album/",
			),
		).not.toThrow();
	});

	it("rejects same-prefix but different segment (path boundary)", () => {
		expect(() =>
			assertTargetInWebDavScope(
				"https://webdav.example.com/album-evil/secret.jpg",
				"https://webdav.example.com/album/",
			),
		).toThrow();
	});

	it("rejects cross-origin target", () => {
		expect(() =>
			assertTargetInWebDavScope(
				"https://evil.example.com/album/photo.jpg",
				"https://webdav.example.com/album/",
			),
		).toThrow();
	});

	it("rejects sibling path outside base", () => {
		expect(() =>
			assertTargetInWebDavScope(
				"https://webdav.example.com/other/photo.jpg",
				"https://webdav.example.com/album/",
			),
		).toThrow();
	});
});
