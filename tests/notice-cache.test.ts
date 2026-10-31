import { describe, expect, it } from "vitest";
import { getNotice } from "../server/notice/service";
import type { CloudflareEnv } from "../types/env";

function makeEnv(row: unknown | null) {
	let calls = 0;
	const env = {
		DB: {
			prepare() {
				calls++;
				return {
					bind() {
						return { first: async () => row };
					},
				};
			},
		},
	} as unknown as CloudflareEnv;
	return { env, calls: () => calls };
}

const ROW = {
	id: 1,
	title: "公告",
	sections_json: JSON.stringify([{ label: "", lines: [{ text: "hi" }] }]),
	updated_at: "2026-01-01",
};

describe("getNotice 版本化缓存（P4）", () => {
	it("首次查 D1；同版本二次命中缓存不再查", async () => {
		const { env, calls } = makeEnv(ROW);
		const a = await getNotice(env, "n.v1");
		expect(calls()).toBe(1);
		expect(a?.title).toBe("公告");
		const b = await getNotice(env, "n.v1");
		expect(calls()).toBe(1); // 命中缓存
		expect(b).toEqual(a);
	});

	it("版本变化 → 失效并重查 D1", async () => {
		const { env, calls } = makeEnv(ROW);
		await getNotice(env, "n.v2");
		await getNotice(env, "n.v3");
		expect(calls()).toBe(2);
	});

	it("无公告行（null）也会被缓存（避免每页白查）", async () => {
		const { env, calls } = makeEnv(null);
		expect(await getNotice(env, "n.v4")).toBeNull();
		expect(await getNotice(env, "n.v4")).toBeNull();
		expect(calls()).toBe(1);
	});
});
