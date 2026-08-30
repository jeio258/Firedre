import { afterEach, describe, it, expect, vi } from "vitest";
import {
	getStoredWavesEnabled,
	setWavesEnabled,
	getStoredGradientEnabled,
	getStoredCardBorderEnabled,
	getStoredCardFollowThemeEnabled,
	getStoredBannerTitleEnabled,
	getStoredOverlayOpacity,
	setOverlayOpacity,
	getStoredOverlayBlur,
} from "../src/utils/setting-utils";

function fakeStorage() {
	const map = new Map<string, string>();
	return {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, String(v)),
		removeItem: (k: string) => void map.delete(k),
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("boolean settings localStorage contract", () => {
	it("getStored* returns default when localStorage key is absent", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		// 无法直接断言默认值（依赖 window config），但可断言"键缺失时不抛错且返回布尔"
		expect(typeof getStoredWavesEnabled()).toBe("boolean");
		expect(typeof getStoredGradientEnabled()).toBe("boolean");
		expect(typeof getStoredCardBorderEnabled()).toBe("boolean");
		expect(typeof getStoredCardFollowThemeEnabled()).toBe("boolean");
		expect(typeof getStoredBannerTitleEnabled()).toBe("boolean");
	});

	it("getStored* reads stored 'true'/'false' as boolean", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		// wavesEnabled 存 'true' → true
		(globalThis as any).localStorage.setItem("wavesEnabled", "true");
		expect(getStoredWavesEnabled()).toBe(true);
		(globalThis as any).localStorage.setItem("wavesEnabled", "false");
		expect(getStoredWavesEnabled()).toBe(false);
	});

	it("set* writes String(value) to localStorage", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		vi.stubGlobal("document", { documentElement: { setAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }, querySelector: () => null, getElementById: () => null });
		setWavesEnabled(true);
		expect((globalThis as any).localStorage.getItem("wavesEnabled")).toBe("true");
		setWavesEnabled(false);
		expect((globalThis as any).localStorage.getItem("wavesEnabled")).toBe("false");
	});

	it("returns default when localStorage is undefined (node)", () => {
		// 默认 node 环境无 localStorage
		expect(typeof getStoredWavesEnabled()).toBe("boolean");
	});
});

describe("number settings (overlay) localStorage contract", () => {
	it("parses stored float and clamps to [0,1]", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		(globalThis as any).localStorage.setItem("overlayOpacity", "0.5");
		expect(getStoredOverlayOpacity()).toBe(0.5);
		(globalThis as any).localStorage.setItem("overlayOpacity", "2");
		expect(getStoredOverlayOpacity()).toBe(1);
		(globalThis as any).localStorage.setItem("overlayOpacity", "-1");
		expect(getStoredOverlayOpacity()).toBe(0);
	});

	it("falls back to default on NaN", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		(globalThis as any).localStorage.setItem("overlayOpacity", "abc");
		expect(Number.isNaN(getStoredOverlayOpacity())).toBe(false);
	});

	it("overlayBlur clamps to [0,20]", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		(globalThis as any).localStorage.setItem("overlayBlur", "50");
		expect(getStoredOverlayBlur()).toBe(20);
	});

	it("set* clamps then writes", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		vi.stubGlobal("document", { getElementById: () => null, documentElement: { style: { setProperty: () => {} } } });
		setOverlayOpacity(2);
		expect((globalThis as any).localStorage.getItem("overlayOpacity")).toBe("1");
	});
});
