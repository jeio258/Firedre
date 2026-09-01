import { defineMiddleware } from "astro:middleware";

export interface SettingsLocals {
	settings: import("../server/settings/service").SiteSettings;
}

export const onRequest = defineMiddleware(async (context, next) => {
	const { request } = context;
	const url = new URL(request.url);

	(globalThis as unknown as { __FIREFLY_ORIGIN__?: string }).__FIREFLY_ORIGIN__ =
		url.origin;

	// HTML 页面快路径：先查缓存，命中即返回，避免 seed/settings/version 串行 D1 查询
	const isHtmlPage =
		request.method === "GET" &&
		!url.pathname.startsWith("/admin") &&
		!url.pathname.startsWith("/api");

	let htmlCacheKey = "";
	if (isHtmlPage) {
		try {
			const { getSettingsVersion } = await import("../server/settings/service");
			const { cfEnv } = await import("./lib/api");
			const version = await getSettingsVersion(cfEnv);

			htmlCacheKey = `${url.origin}/__html_cache__/${url.pathname}?v=${version}`;
			const cached = await caches.default.match(htmlCacheKey);
			if (cached) {
				return new Response(await cached.text(), {
					headers: {
						"Content-Type": "text/html; charset=utf-8",

						"Cache-Control": "public, max-age=0, must-revalidate",
						"X-Firedre-Cache": "CACHE-HIT",
					},
				});
			}
		} catch {
			// 缓存不可用不影响主流程
		}
	}

	try {
		const [{ getAllSettings, SETTING_GROUPS }, { settingsDefaults }] =
			await Promise.all([
				import("../server/settings/service"),
				import("./config/settings-defaults"),
			]);
		const { cfEnv } = await import("./lib/api");

		// seed 与 settings 并行（seed 仅新 isolate 执行一次）
		const seedFlag = globalThis as unknown as { __FIREDRE_SEEDED__?: boolean };
		const seedTask = seedFlag.__FIREDRE_SEEDED__
			? Promise.resolve()
			: (async () => {
					seedFlag.__FIREDRE_SEEDED__ = true;
					try {
						const { ensureDefaultPosts } = await import("../server/posts/seed");
						await ensureDefaultPosts(cfEnv);
					} catch {
						// seed 失败不影响请求
					}
				})();
		const [groups] = await Promise.all([getAllSettings(cfEnv), seedTask]);

		const merged: Record<string, unknown> = {};
		const defaults = settingsDefaults as unknown as Record<string, Record<string, unknown>>;

		const groupNames = new Set<string>(SETTING_GROUPS as unknown as string[]);

		const normalize = (v: unknown): unknown => {
			if (typeof v === "string") {
				const t = v.trim();
				const looksJson =
					(t.startsWith("[") && t.endsWith("]")) ||
					(t.startsWith("{") && t.endsWith("}"));
				if (looksJson) {
					try { return JSON.parse(t); } catch { return v; }
				}
			}
			return v;
		};

		const fieldGroupCount = new Map<string, number>();
		for (const [, group] of Object.entries(defaults)) {
			for (const k of Object.keys(group ?? {})) {
				fieldGroupCount.set(k, (fieldGroupCount.get(k) ?? 0) + 1);
			}
		}
		const conflictedKeys = new Set<string>();
		for (const [k, n] of fieldGroupCount) if (n > 1) conflictedKeys.add(k);

		const assignFlat = (target: Record<string, unknown>, g: Record<string, unknown>) => {
			for (const [k, v] of Object.entries(g)) {
				if (groupNames.has(k)) continue;
				if (conflictedKeys.has(k)) continue;
				if (v === "" || v == null) continue;
				target[k] = v;
			}
		};
		// 1. 先铺默认值（嵌套组 + 平铺标量）
		for (const [groupKey, group] of Object.entries(defaults)) {
			const g: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(group ?? {})) g[k] = normalize(v);
			merged[groupKey] = g;
			assignFlat(merged, g);
		}
		// 2. 数据库值覆盖其上
		for (const [groupKey, group] of Object.entries(groups)) {
			const g: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(group ?? {})) g[k] = normalize(v);
			merged[groupKey] = { ...(merged[groupKey] as Record<string, unknown> ?? {}), ...g };
			assignFlat(merged, g);
		}

		const pageMap: Record<string, string> = {
			pageFriends: "friends",
			pageGuestbook: "guestbook",
			pageDynamic: "dynamic",
			pageGallery: "gallery",
			pageBooknav: "booknav",
			pageBilibili: "bilibili",
			pageBangumi: "bangumi",
			pageVndb: "vndb",
			pageMal: "mal",
			pageSponsor: "sponsor",
		};
		const basicGroup = (merged.basic ?? {}) as Record<string, unknown>;
		const pagesOut: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(pageMap)) {
			if (typeof basicGroup[k] === "boolean") pagesOut[v] = basicGroup[k];
		}
		merged.pages = { ...(merged.pages as Record<string, unknown> ?? {}), ...pagesOut };
		(context.locals as unknown as SettingsLocals).settings = merged;
	} catch {
		(context.locals as unknown as SettingsLocals).settings = {};
	}

	const response = await next();

	if (request.method === "GET") {
		response.headers.set("X-Content-Type-Options", "nosniff");
		response.headers.set("X-Frame-Options", "SAMEORIGIN");
		response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	}

	if (url.pathname.startsWith("/admin") && request.method === "GET") {
		response.headers.set("Cache-Control", "no-store");
	}
	if (request.method === "GET") {
		const contentType = response.headers.get("content-type") || "";
		const isCacheableHtml =
			contentType.includes("text/html") &&
			!url.pathname.startsWith("/admin") &&
			!url.pathname.startsWith("/api");

		if (isCacheableHtml && htmlCacheKey && response.status === 200) {

			response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
			try {
				const html = await response.clone().text();
				if (html.length > 500 && html.length < 900_000) {
					await caches.default.put(
						htmlCacheKey,
						new Response(html, {
							headers: {
								"Content-Type": "text/html; charset=utf-8",
								"Cache-Control": "public, max-age=60",
							},
						}),
					);
				}
			} catch {

			}
		}
	}
	return response;
});
