import { describe, expect, it } from "vitest";
import {
	redactSensitive,
	SENSITIVE_SETTING_KEY,
} from "../server/settings/sensitive";

const SENSITIVE_KEYS = [
	"auth",
	"token",
	"secret",
	"password",
	"apikey",
	"api_key",
	"apiKey",
	"customcode",
	"accesskey",
	"adsense",
	"clientid",
	"username",
	"webdav",
	"endpoint",
	"imgdir",
	"imghost",
];

const PLAIN_KEYS = [
	"title",
	"desc",
	"enabled",
	"url",
	"icon",
	"weight",
	"sortOrder",
	"kind",
	"location",
	"hue",
	"mode",
	"pageDynamic",
	"overlayCardOpacity",
];

describe("SENSITIVE_SETTING_KEY 匹配规则", () => {
	it("16 个敏感片段逐一命中", () => {
		for (const key of SENSITIVE_KEYS) {
			expect(SENSITIVE_SETTING_KEY.test(key), key).toBe(true);
		}
	});

	it("普通设置键不命中", () => {
		for (const key of PLAIN_KEYS) {
			expect(SENSITIVE_SETTING_KEY.test(key), key).toBe(false);
		}
	});

	it("大小写不敏感", () => {
		expect(SENSITIVE_SETTING_KEY.test("TOKEN")).toBe(true);
		expect(SENSITIVE_SETTING_KEY.test("Token")).toBe(true);
		expect(SENSITIVE_SETTING_KEY.test("WebDav")).toBe(true);
		expect(SENSITIVE_SETTING_KEY.test("UserName")).toBe(true);
	});

	it("按子串匹配而非精确键名", () => {
		expect(SENSITIVE_SETTING_KEY.test("twitterToken")).toBe(true);
		expect(SENSITIVE_SETTING_KEY.test("my_secret_key")).toBe(true);
		expect(SENSITIVE_SETTING_KEY.test("webdavUrl")).toBe(true);
		expect(SENSITIVE_SETTING_KEY.test("imgHost")).toBe(true);
		expect(SENSITIVE_SETTING_KEY.test("bilibiliUid")).toBe(false);
	});

	it("文档化过度匹配：author 含 auth 会被清空", () => {
		expect(SENSITIVE_SETTING_KEY.test("author")).toBe(true);
		expect(redactSensitive({ author: "夏叶" })).toEqual({ author: "" });
	});
});

describe("redactSensitive 结构与边界", () => {
	it("primitive 原样返回", () => {
		expect(redactSensitive("hello")).toBe("hello");
		expect(redactSensitive(0)).toBe(0);
		expect(redactSensitive(1)).toBe(1);
		expect(redactSensitive(false)).toBe(false);
		expect(redactSensitive(true)).toBe(true);
		expect(redactSensitive("")).toBe("");
		expect(redactSensitive(undefined)).toBeUndefined();
	});

	it("null 原样返回（falsy，不进对象分支）", () => {
		expect(redactSensitive(null)).toBeNull();
	});

	it("非敏感键保留原值，含 falsy 值不被吞掉", () => {
		const out = redactSensitive({
			title: "站点",
			desc: "",
			enabled: false,
			weight: 0,
			cover: null,
			tags: ["a"],
		});
		expect(out).toEqual({
			title: "站点",
			desc: "",
			enabled: false,
			weight: 0,
			cover: null,
			tags: ["a"],
		});
	});

	it("嵌套对象递归脱敏", () => {
		const out = redactSensitive({
			basic: { title: "t", hue: 165 },
			profile: { name: "n", links: [] },
		});
		expect(out).toEqual({
			basic: { title: "t", hue: 165 },
			profile: { name: "n", links: [] },
		});
	});

	it("敏感键的值恒替换为空串，且不递归进去", () => {
		expect(
			redactSensitive({ webdav: { url: "https://d", username: "u" } }),
		).toEqual({ webdav: "" });
		expect(redactSensitive({ password: 12345 })).toEqual({ password: "" });
		expect(redactSensitive({ apiTokens: ["a", "b"] })).toEqual({
			apiTokens: "",
		});
	});

	it("对象内数组逐元素递归", () => {
		const out = redactSensitive({
			links: [
				{ name: "a", token: "t1" },
				{ name: "b", secret: "s1" },
			],
		});
		expect(out).toEqual({
			links: [
				{ name: "a", token: "" },
				{ name: "b", secret: "" },
			],
		});
	});

	it("顶层数组逐元素处理", () => {
		expect(redactSensitive([{ token: "x" }, "plain", 7])).toEqual([
			{ token: "" },
			"plain",
			7,
		]);
	});

	it("空对象与空数组", () => {
		expect(redactSensitive({})).toEqual({});
		expect(redactSensitive([])).toEqual([]);
	});

	it("幂等：二次脱敏结果不变", () => {
		const once = redactSensitive({
			basic: { title: "t" },
			vndb: { username: "u" },
			list: [{ token: "x" }],
		});
		expect(redactSensitive(once)).toEqual(once);
	});

	it("无副作用：不改动入参", () => {
		const input = {
			basic: { title: "t" },
			vndb: { username: "u", endpoint: "https://e" },
			links: [{ name: "a", token: "t1" }],
		};
		const snapshot = structuredClone(input);
		redactSensitive(input);
		expect(input).toEqual(snapshot);
	});

	it("文档化边界：只按键名脱敏，不检查值内容", () => {
		expect(redactSensitive({ note: "password=abc123" })).toEqual({
			note: "password=abc123",
		});
	});

	it("文档化现状：非普通对象（Date）会被清空为 {}", () => {
		const when = new Date("2026-01-01T00:00:00Z");
		expect(redactSensitive({ when })).toEqual({ when: {} });
	});
});

describe("redactSensitive 真实设置形状（非管理员读取路径）", () => {
	const settings = {
		basic: { title: "Firedre", hue: 165, pageDynamic: true },
		theme: { mode: "banner", overlayCardOpacity: 0.6 },
		vndb: { username: "vndb-user", endpoint: "https://api.vndb.org" },
		mal: { username: "mal-user" },
		bilibili: { clientId: "cid-123", enabled: true },
		webdav: { url: "https://dav.example.com" },
		ads: { customCode: "<ins></ins>" },
	};

	it("仅敏感键被清空，普通键完整保留", () => {
		const out = redactSensitive(settings);

		expect(out.basic).toEqual({
			title: "Firedre",
			hue: 165,
			pageDynamic: true,
		});
		expect(out.theme).toEqual({ mode: "banner", overlayCardOpacity: 0.6 });
		// vndb 键名本身不敏感 → 递归进入，username/endpoint 两个子键被清空
		expect(out.vndb).toEqual({ username: "", endpoint: "" });
		expect(out.mal).toEqual({ username: "" });
		expect(out.bilibili).toEqual({ clientId: "", enabled: true });
		// webdav 键名本身敏感 → 整个值被替换为空串
		expect(out.webdav).toBe("");
		// ads 键名不敏感 → 递归进入，customCode 被清空
		expect(out.ads).toEqual({ customCode: "" });
	});

	it("脱敏后原始对象未被污染", () => {
		expect(settings.vndb.username).toBe("vndb-user");
		expect(settings.bilibili.clientId).toBe("cid-123");
	});
});
