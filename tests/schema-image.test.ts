import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ failUrl: false }));

vi.mock("@/config", () => ({
	siteConfig: { site_url: "https://example.com", navbar: {}, favicon: [] },
	profileConfig: { avatar: undefined },
}));

// url() 可控抛错：模拟 computeSiteLogo 依赖失败
vi.mock("@shared/utils/url-utils", () => ({
	isAbsoluteUrl: (s: string) => /^https?:\/\//.test(s),
	url: (s: string) => {
		if (h.failUrl) throw new Error("boom");
		return s;
	},
}));

import { getSiteLogo } from "../src/utils/schema-image";

afterEach(() => {
	h.failUrl = false;
});

describe("getSiteLogo 解析缓存", () => {
	it("依赖抛错时不产生 rejected Promise，且失败不入缓存（可重试）", async () => {
		h.failUrl = true;
		// 修复前：rejected Promise 被永久缓存 → 这里 reject（并后续一直 reject）
		await expect(getSiteLogo("https://example.com")).resolves.toBeNull();

		// 失败已剔除缓存 → 依赖恢复后可重试成功
		h.failUrl = false;
		const ok = await getSiteLogo("https://example.com");
		expect(ok?.url).toBe("https://example.com/favicon/favicon-light-192.png");
	});

	it("成功结果被缓存（同 siteUrl 只解析一次）", async () => {
		const a = await getSiteLogo("https://cache.example");
		const b = await getSiteLogo("https://cache.example");
		expect(a).toEqual(b);
		expect(a?.url).toContain("/favicon/");
	});
});
