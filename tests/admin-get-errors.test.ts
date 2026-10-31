import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ verifyThrows: false }));

vi.mock("../src/lib/api", () => ({
	cfEnv: {},
	json: (data: unknown, status = 200) =>
		new Response(JSON.stringify(data), { status }),
	serverError: () => new Response("server error", { status: 500 }),
	unauthorized: () => new Response(null, { status: 401 }),
	methodNotAllowed: () => new Response(null, { status: 405 }),
}));

vi.mock("@server/auth/adminSession", () => ({
	verifyAdminRequest: async () => {
		if (h.verifyThrows) throw new Error("SESSION_SECRET 未配置");
		return true;
	},
	getAuthenticatedAdminUsername: async () => "admin",
}));

async function callMe() {
	const mod = await import("../src/pages/api/admin/[...path].ts");
	return mod.GET({
		params: { path: "me" },
		request: new Request("https://x/api/admin/me"),
	} as never);
}

afterEach(() => {
	h.verifyThrows = false;
});

describe("admin API GET /me 错误语义（P7）", () => {
	it("鉴权依赖抛错 → 500（不再伪装成 401）", async () => {
		h.verifyThrows = true;
		const res = await callMe();
		expect(res.status).toBe(500);
	});

	it("正常鉴权 → 200 且返回用户名", async () => {
		h.verifyThrows = false;
		const res = await callMe();
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ authenticated: true });
	});
});
