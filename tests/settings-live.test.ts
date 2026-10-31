import { afterEach, describe, expect, it, vi } from "vitest";

// settings-live 是浏览器模块（依赖 document/window）→ 先垫最小 DOM 再动态 import
function setupDom() {
	const listeners: Record<string, () => void> = {};
	vi.stubGlobal("document", {
		documentElement: { getAttribute: () => "" },
		addEventListener: (t: string, cb: () => void) => {
			listeners[t] = cb;
		},
		dispatchEvent: () => true,
	});
	vi.stubGlobal("window", {});
	vi.stubGlobal(
		"CustomEvent",
		class {
			type: string;
			detail: unknown;
			constructor(t: string, i?: { detail?: unknown }) {
				this.type = t;
				this.detail = i?.detail;
			}
		},
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("settings-live 检查超时自愈", () => {
	it("请求挂起时超时结束，checking 被释放（不会永久关闭实时感知）", async () => {
		setupDom();
		let calls = 0;
		vi.stubGlobal("fetch", (_url: string, init?: { signal?: AbortSignal }) => {
			calls++;
			if (calls === 1) {
				// 第一次：挂起，仅当 signal 中止时 reject（模拟卡住的请求）
				return new Promise((_res, rej) => {
					init?.signal?.addEventListener("abort", () =>
						rej(new Error("aborted")),
					);
				});
			}
			// 第二次：正常返回新版本
			return Promise.resolve(
				new Response(JSON.stringify({ version: "v2", settings: {} }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);
		});

		const { checkSettingsChanged } = await import("../src/utils/settings-live");

		// 修复前：无超时 → 这次 await 会一直挂起（测试超时失败）
		const first = await checkSettingsChanged(20);
		expect(first).toBe(false);

		// checking 已释放 → 可再次检查并成功
		const second = await checkSettingsChanged(20);
		expect(second).toBe(true);
		expect(calls).toBe(2);
	});
});
