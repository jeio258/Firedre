import { describe, expect, it, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	createSiteLink,
	deleteSiteLink,
	listEnabledSiteLinks,
	listSiteLinks,
	updateSiteLink,
} from "../server/siteLinks/service";

interface D1Like {
	prepare(sql: string): D1StmtLike;
}
interface D1StmtLike {
	bind(...args: unknown[]): D1StmtLike;
	run(): Promise<unknown>;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

function makeD1(db: DatabaseSync): D1Like {
	return {
		prepare(sql: string) {
			let args: unknown[] = [];
			const stmt = db.prepare(sql);
			const bind = (...more: unknown[]) => {
				args = [...args, ...more];
				return chain;
			};
			const chain: D1StmtLike = {
				bind,
				run: async () => {
					const res = (stmt as unknown as { run(...a: unknown[]): { changes: number; lastInsertRowid: number } }).run(...args);
					return { meta: { last_row_id: res.lastInsertRowid, changes: res.changes } };
				},
				first: async <T>() =>
					((stmt as unknown as { get(...a: unknown[]): unknown }).get(
						...args,
					) as T | undefined) ?? null,
				all: async <T>() => {
					const rows = (stmt as unknown as { all(...a: unknown[]): unknown[] }).all(
						...args,
					) as T[];
					return { results: rows };
				},
			};
			return chain;
		},
	};
}

let db: DatabaseSync;
let env: { DB: D1Like };

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	const migDir = join(process.cwd(), "migrations");
	db.exec(readFileSync(join(migDir, "0019_site_links.sql"), "utf8"));
	db.exec(readFileSync(join(migDir, "0020_site_links_extend.sql"), "utf8"));
	env = { DB: makeD1(db) };
});

describe("site_links 数据层", () => {
	it("seed：0020 迁移已写入 9 条外链 + 4 条打赏", async () => {
		const all = await listSiteLinks(env as never);
		const navbar = all.filter((l) => l.location === "navbar");
		const footer = all.filter((l) => l.location === "footer");
		const profile = all.filter((l) => l.location === "profile");
		const sponsor = all.filter((l) => l.location === "sponsor");
		expect(navbar.length).toBe(4);
		expect(footer.length).toBe(1);
		expect(profile.length).toBe(4);
		expect(sponsor.length).toBe(4);
		expect(sponsor.filter((l) => l.kind === "qr").length).toBe(2);
		expect(sponsor.filter((l) => l.kind === "link").length).toBe(2);
		expect(profile.some((l) => l.url === "mailto:xiaye@msn.com")).toBe(true);
		expect(profile.some((l) => l.url === "/rss/")).toBe(true);
	});

	it("新增链接回填 id/默认值", async () => {
		const created = await createSiteLink(env as never, {
			name: "GitHub",
			url: "https://github.com/you",
			icon: "fa7-brands:github",
			location: "navbar",
		});
		expect(created.id).toBeGreaterThan(0);
		expect(created.location).toBe("navbar");
		expect(created.enabled).toBe(true);
		expect(created.sortOrder).toBe(0);
		expect(created.kind).toBe("link");
	});

	it("name/url 为空抛 UserError", async () => {
		await expect(
			createSiteLink(env as never, { name: "", url: "https://x.com" }),
		).rejects.toThrow();
		await expect(
			createSiteLink(env as never, { name: "X", url: "" }),
		).rejects.toThrow();
	});

	it("拒绝危险 URL scheme（javascript: 等 XSS）", async () => {
		await expect(
			createSiteLink(env as never, { name: "X", url: "javascript:alert(1)" }),
		).rejects.toThrow();
	});

	it("放行 http/https/mailto/相对路径（打赏二维码外链与 RSS）", async () => {
		const mail = await createSiteLink(env as never, {
			name: "Email",
			url: "mailto:x@example.com",
			location: "profile",
		});
		expect(mail.url).toBe("mailto:x@example.com");
		const rss = await createSiteLink(env as never, {
			name: "RSS",
			url: "/rss/",
			location: "profile",
		});
		expect(rss.url).toBe("/rss/");
		const qr = await createSiteLink(env as never, {
			name: "支付宝",
			url: "https://cdn.example.com/alipay.png",
			location: "sponsor",
			kind: "qr",
		});
		expect(qr.location).toBe("sponsor");
		expect(qr.kind).toBe("qr");
	});

	it("location 非法值回退 navbar，kind 非法值回退 link", async () => {
		const created = await createSiteLink(env as never, {
			name: "Bad",
			url: "https://x.com",
			location: "hack" as never,
			kind: "foo" as never,
		});
		expect(created.location).toBe("navbar");
		expect(created.kind).toBe("link");
	});

	it("listEnabledSiteLinks 按 location 过滤且排除停用项", async () => {
		// 0019/0020 seed 已含 1 条启用的 footer（Firefly）
		await createSiteLink(env as never, { name: "FooterA", url: "https://a.com", location: "footer" });
		const disabled = await createSiteLink(env as never, {
			name: "FooterB",
			url: "https://b.com",
			location: "footer",
			enabled: false,
		});
		const footer = await listEnabledSiteLinks(env as never, "footer");
		expect(footer.length).toBe(2);
		expect(footer.some((l) => l.name === "FooterA")).toBe(true);
		expect(footer.some((l) => l.name === "Firefly")).toBe(true);
		expect(footer.some((l) => l.name === "FooterB")).toBe(false);
		// 停用项仍在后台全量列表中
		const all = await listSiteLinks(env as never);
		expect(all.some((l) => l.id === disabled.id)).toBe(true);
	});

	it("更新链接与排序", async () => {
		const created = await createSiteLink(env as never, {
			name: "P1",
			url: "https://p1.com",
			location: "profile",
			sortOrder: 5,
		});
		const updated = await updateSiteLink(env as never, created.id, {
			name: "P1-改",
			url: "https://p1.com/new",
			location: "profile",
			sortOrder: 1,
		});
		expect(updated.name).toBe("P1-改");
		expect(updated.sortOrder).toBe(1);
		expect(updated.location).toBe("profile");
	});

	it("删除链接", async () => {
		const created = await createSiteLink(env as never, { name: "Del", url: "https://del.com" });
		const ok = await deleteSiteLink(env as never, created.id);
		expect(ok).toBe(true);
		const all = await listSiteLinks(env as never);
		expect(all.some((l) => l.id === created.id)).toBe(false);
	});

	it("更新不存在的链接抛 UserError", async () => {
		await expect(
			updateSiteLink(env as never, 99999, { name: "X", url: "https://x.com" }),
		).rejects.toThrow();
	});
});
