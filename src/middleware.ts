import { defineMiddleware } from "astro:middleware";
import { getPlantumlConfig } from "./config/runtime";
import { setPlantumlRuntimeConfig } from "./config/plantumlRuntime";

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
			const { getSettingsVersionCached } = await import("../server/settings/service");
			const { cfEnv } = await import("./lib/api");
			const version = await getSettingsVersionCached(cfEnv);

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
		const [groups, { mergeSettings }] = await Promise.all([
			getAllSettings(cfEnv),
			import("../server/settings/merge"),
			seedTask,
		]);

		const defaults = settingsDefaults as unknown as Record<string, Record<string, unknown>>;
		const groupNames = new Set<string>(SETTING_GROUPS as unknown as string[]);
		const merged = mergeSettings(defaults, groups, groupNames);

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

	setPlantumlRuntimeConfig(getPlantumlConfig(context.locals));

	const response = await next();

	// 安全响应头对所有 HTTP 方法生效（含 API 写操作的响应）
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("X-Frame-Options", "SAMEORIGIN");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set(
		"Strict-Transport-Security",
		"max-age=31536000; includeSubDomains",
	);
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), payment=()",
	);
	response.headers.set(
		"Content-Security-Policy-Report-Only",
		"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
	);

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
