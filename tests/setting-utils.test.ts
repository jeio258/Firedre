import { afterEach, describe, it, expect, vi } from "vitest";
import {
	getStoredWavesEnabled,
	setWavesEnabled,
	getStoredGradientEnabled,
	getStoredCardBorderEnabled,
	setCardBorderEnabled,
	getStoredCardFollowThemeEnabled,
	setCardFollowThemeEnabled,
	getStoredBannerTitleEnabled,
	getStoredOverlayOpacity,
	setOverlayOpacity,
	getStoredOverlayBlur,
	setOverlayBlur,
	getStoredOverlayCardOpacity,
	setOverlayCardOpacity,
	getStoredSakuraEnabled,
	setSakuraEnabled,
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

		expect(typeof getStoredWavesEnabled()).toBe("boolean");
	});

	it("returns default when localStorage exists but getItem is missing", () => {

		vi.stubGlobal("localStorage", { setItem: () => {} });
		expect(typeof getStoredWavesEnabled()).toBe("boolean");
		expect(typeof getStoredOverlayOpacity()).toBe("number");
	});

	it("cardBorder/cardFollowTheme/sakura read stored value as boolean", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		(globalThis as any).localStorage.setItem("cardBorderEnabled", "true");
		expect(getStoredCardBorderEnabled()).toBe(true);
		(globalThis as any).localStorage.setItem("cardFollowThemeEnabled", "false");
		expect(getStoredCardFollowThemeEnabled()).toBe(false);
	});

	it("sakura getStored* parses stored value", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		(globalThis as any).localStorage.setItem("sakuraEnabled", "true");
		expect(getStoredSakuraEnabled()).toBe(true);
	});

	it("set* triggers DOM side effects (data attributes / classList)", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		const el = {
			classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false), toggle: vi.fn() },
			setAttribute: vi.fn(),
			removeAttribute: vi.fn(),
			style: { setProperty: vi.fn() },
		};
		vi.stubGlobal("document", {
			documentElement: el,
			body: el,
			querySelector: () => el,
			getElementById: () => el,
		});
		vi.stubGlobal("window", { dispatchEvent: vi.fn() });
		setWavesEnabled(true);
		expect(el.setAttribute).toHaveBeenCalledWith("data-waves-enabled", "true");
		setSakuraEnabled(true);
		expect(el.setAttribute).toHaveBeenCalledWith("data-sakura-enabled", "true");
		setCardBorderEnabled(true);
		expect(el.classList.add).toHaveBeenCalledWith("enable-card-border");
		setCardFollowThemeEnabled(true);
		expect(el.classList.add).toHaveBeenCalledWith("card-follow-theme-hue");
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

	it("overlayCardOpacity parses and clamps to [0,1]", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		(globalThis as any).localStorage.setItem("overlayCardOpacity", "0.5");
		expect(getStoredOverlayCardOpacity()).toBe(0.5);
		(globalThis as any).localStorage.setItem("overlayCardOpacity", "3");
		expect(getStoredOverlayCardOpacity()).toBe(1);
	});

	it("setOverlayBlur clamps to [0,20] then writes", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		vi.stubGlobal("document", { getElementById: () => null, documentElement: { style: { setProperty: () => {} } } });
		setOverlayBlur(50);
		expect((globalThis as any).localStorage.getItem("overlayBlur")).toBe("20");
	});

	it("setOverlayCardOpacity clamps to [0,1] then writes", () => {
		vi.stubGlobal("localStorage", fakeStorage());
		vi.stubGlobal("document", { getElementById: () => null, documentElement: { style: { setProperty: () => {} } } });
		setOverlayCardOpacity(2);
		expect((globalThis as any).localStorage.getItem("overlayCardOpacity")).toBe("1");
	});
});
