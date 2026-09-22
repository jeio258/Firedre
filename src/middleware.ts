import { defineMiddleware } from "astro:middleware";
import { setPlantumlRuntimeConfig } from "@shared/config/plantumlRuntime";
import { getPlantumlConfig } from "./config/runtime";

export interface SettingsLocals {
	settings: import("@server/settings/service").SettingsView;
	settingsVersion?: string;
}

// HTML 边缘缓存：s-maxage=60 让 Cloudflare CDN 缓存（重复访客不跑 worker，TTFB 大幅下降）；
// 后台设置改动经 settingsVersion 在 worker 缓存路径即时生效，CDN 层接受 ≤60s 有界滞后
const HTML_CACHE_CONTROL =
	"public, max-age=0, s-maxage=60, stale-while-revalidate=86400";
// CF 专用：指示 Cloudflare 边缘按此 TTL 缓存本响应（Pages 默认不缓存 HTML，需此头 + 站点缓存规则配合）
const HTML_CDN_CACHE_CONTROL = "public, max-age=60";

// 安全响应头对缓存命中与渲染路径统一生效
function applySecurityHeaders(headers: Headers) {
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Frame-Options", "SAMEORIGIN");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set(
		"Strict-Transport-Security",
		"max-age=31536000; includeSubDomains",
	);
	headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), payment=()",
	);
	headers.set(
		"Content-Security-Policy-Report-Only",
		"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
	);
}

export const onRequest = defineMiddleware(async (context, next) => {
	const { request } = context;
	const url = new URL(request.url);

	// HTML 页面快路径：先查缓存，命中即返回，避免 seed/settings/version 串行 D1 查询
	const isHtmlPage =
		request.method === "GET" &&
		!url.pathname.startsWith("/admin") &&
		!url.pathname.startsWith("/api") &&
		!url.pathname.startsWith("/i18n.js");

	let htmlCacheKey = "";
	let settingsVersion = "";
	if (isHtmlPage) {
		try {
			const { getSettingsVersionCached } = await import(
				"@server/settings/service"
			);
			const { cfEnv } = await import("./lib/api");
			settingsVersion = await getSettingsVersionCached(cfEnv);

			htmlCacheKey = `${url.origin}/__html_cache__/${url.pathname}?v=${settingsVersion}`;
			const cached = await caches.default.match(htmlCacheKey);
			if (cached) {
				const headers = new Headers({
					"Content-Type": "text/html; charset=utf-8",

					"Cache-Control": HTML_CACHE_CONTROL,
					"Cloudflare-CDN-Cache-Control": HTML_CDN_CACHE_CONTROL,
					"X-Firedre-Cache": "CACHE-HIT",
				});
				applySecurityHeaders(headers);
				return new Response(await cached.text(), { headers });
			}
		} catch {
			// 缓存不可用不影响主流程
		}
	}

	try {
		const [{ getAllSettings, SETTING_GROUPS }, { settingsDefaults }] =
			await Promise.all([
				import("@server/settings/service"),
				import("@shared/config/settings-defaults"),
			]);
		const { cfEnv } = await import("./lib/api");

		// schema 引导先于渲染：空库首次访问自动建表，避免渲染层查询 500（isolate 内缓存零开销）
		const { ensureSchema } = await import("@server/posts/seed");
		await ensureSchema(cfEnv);

		// seed 仅新 isolate 执行一次（后台运行，不阻塞当前请求）
		const seedFlag = globalThis as unknown as { __FIREDRE_SEEDED__?: boolean };
		if (!seedFlag.__FIREDRE_SEEDED__) {
			seedFlag.__FIREDRE_SEEDED__ = true;
			(async () => {
				try {
					const { ensureDefaultPosts } = await import("@server/posts/seed");
					await ensureDefaultPosts(cfEnv);
				} catch {
					// seed 失败不影响请求
				}
			})();
		}
		// getAllSettings isolate 级缓存：以设置版本为键（任何设置写入都会自增版本号），
		// 命中时省去每 cache-miss 请求的全表 D1 读；TTL 兜底覆盖直改 D1 不 bump 版本的场景
		const settingsCache = globalThis as unknown as {
			__FIREDRE_SETTINGS_CACHE__?: {
				version: string;
				groups: Record<string, Record<string, unknown>>;
				at: number;
			};
		};
		let groups: Record<string, Record<string, unknown>>;
		const cachedGroups = settingsCache.__FIREDRE_SETTINGS_CACHE__;
		if (
			cachedGroups &&
			cachedGroups.version === settingsVersion &&
			Date.now() - cachedGroups.at < 30_000
		) {
			groups = cachedGroups.groups;
		} else {
			groups = await getAllSettings(cfEnv);
			settingsCache.__FIREDRE_SETTINGS_CACHE__ = {
				version: settingsVersion,
				groups,
				at: Date.now(),
			};
		}
		const { mergeSettings } = await import("@server/settings/merge");

		const defaults = settingsDefaults as unknown as Record<
			string,
			Record<string, unknown>
		>;
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
		merged.pages = {
			...((merged.pages as Record<string, unknown>) ?? {}),
			...pagesOut,
		};
		(context.locals as unknown as SettingsLocals).settings = merged;
		if (settingsVersion) {
			(context.locals as unknown as SettingsLocals).settingsVersion =
				settingsVersion;
		}
	} catch (e) {
		console.warn("[middleware] 站点设置加载失败，本次请求以空配置渲染", e);
		(context.locals as unknown as SettingsLocals).settings = {};
	}

	setPlantumlRuntimeConfig(getPlantumlConfig(context.locals));

	const response = await next();

	// 安全响应头对所有 HTTP 方法生效（含 API 写操作的响应）
	applySecurityHeaders(response.headers);

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
			response.headers.set("Cache-Control", HTML_CACHE_CONTROL);
			response.headers.set(
				"Cloudflare-CDN-Cache-Control",
				HTML_CDN_CACHE_CONTROL,
			);
			try {
				const html = await response.clone().text();
				if (html.length > 500 && html.length < 900_000) {
					await caches.default.put(
						htmlCacheKey,
						new Response(html, {
							headers: {
								"Content-Type": "text/html; charset=utf-8",
								"Cache-Control": HTML_CACHE_CONTROL,
							},
						}),
					);
				}
			} catch {}
		}
	}
	return response;
});
