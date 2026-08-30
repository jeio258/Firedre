import { defineMiddleware } from "astro:middleware";

export interface SettingsLocals {
	settings: import("../server/settings/service").SiteSettings;
}

/**
 * Firedre middleware：
 * 1. HTML 文件服务（后台管理的 /{slug}.html，存储于 R2）
 * 2. SSR 页面边缘缓存：正常页面 1 分钟新鲜 + 10 分钟后台刷新，
 *    大幅降低 Worker 渲染压力并稳定刷新体验；/admin 等需登录的路径不缓存。
 */
export const onRequest = defineMiddleware(async (context, next) => {
	const { request } = context;
	const url = new URL(request.url);

	// 注入当前请求的 origin 到全局，供 SSR 阶段的 fetchWithDedup 构造绝对 URL。
	// Cloudflare Worker（workerd）的 fetch 不接受相对 URL，而纯工具函数（fetch-dedup.ts）
	// 拿不到 Astro.url，只能通过这个全局单例读取。
	(globalThis as unknown as { __FIREFLY_ORIGIN__?: string }).__FIREFLY_ORIGIN__ =
		url.origin;

	// 注入站点设置（flare-stack-blog 模式）：
	// 默认值（静态 config 提取的 settings-defaults）为基底，数据库已保存值覆盖其上 → 组件统一读 settings（总有值）
	try {
		const { getAllSettings, SETTING_GROUPS } = await import("../server/settings/service");
		const { cfEnv } = await import("./lib/api");
		const { settingsDefaults } = await import("./config/settings-defaults");
		const groups = await getAllSettings(cfEnv);
		const merged: Record<string, unknown> = {};
		const defaults = settingsDefaults as unknown as Record<string, Record<string, unknown>>;
		// 组名集合：扁平字段不得覆盖组键。
		// 否则 expressive/mermaid/plantuml 的 theme 字段会把 theme 组对象覆盖成字符串
		// （settings.theme.mode 失效），同理其它同名冲突。
		const groupNames = new Set<string>(SETTING_GROUPS as unknown as string[]);
		// 类 JSON 字符串 → 解析为数组/对象（defaults 提取与后台保存的 json 字段均为字符串，
		// 组件期望数组结构，如 links/localPlaylist/homeSubtitles/navItems…）
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
		// 计算跨组冲突字段：同名字段出现在多个组（title/description/name/mode/theme/enabled/enable/type/
		// darkTheme/lightTheme），平铺槽位会因组处理顺序而语义漂移（如 music.mode 覆盖 theme.mode、
		// license.name 覆盖 profile.name）。这些字段一律不写入平铺层，组件必须走嵌套访问
		// （settings.basic.title / settings.theme.mode / settings.profile.name…），真实保存值在嵌套层始终正确。
		const fieldGroupCount = new Map<string, number>();
		for (const [, group] of Object.entries(defaults)) {
			for (const k of Object.keys(group ?? {})) {
				fieldGroupCount.set(k, (fieldGroupCount.get(k) ?? 0) + 1);
			}
		}
		const conflictedKeys = new Set<string>();
		for (const [k, n] of fieldGroupCount) if (n > 1) conflictedKeys.add(k);
		// 平铺辅助：空字符串/null 不覆盖；组名键与跨组冲突键跳过（保护嵌套组对象，强制嵌套读取）。
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
		// 3. 页面开关映射：后台 basic 组的 pageXxx → 前端读取的 settings.pages.xxx
		//    前端页面（friends/gallery/dynamic/bilibili/bangumi/vndb/mal/…）读 settings.pages.xxx 判断页面开关，
		//    但后台保存的是 basic 组的 pageXxx 字段。这里统一映射生成 settings.pages。
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

	// HTML 缓存命中检查（Workers Cache API，key 含配置版本号；/admin、/api 不缓存）
	// Cache API 读远快于回源渲染（~2-5s）；配置保存 → 版本+1 → key 变化 → 即时失效
	let htmlCacheKey = "";
	if (
		request.method === "GET" &&
		!url.pathname.startsWith("/admin") &&
		!url.pathname.startsWith("/api")
	) {
		try {
			const { getSettingsVersion } = await import("../server/settings/service");
			const { cfEnv } = await import("./lib/api");
			const version = await getSettingsVersion(cfEnv);
			htmlCacheKey = `html:v${version}:${url.pathname}`;
			const cached = await caches.default.match(htmlCacheKey);
			if (cached) {
				return new Response(await cached.text(), {
					headers: {
						"Content-Type": "text/html; charset=utf-8",
						// max-age=0+must-revalidate：浏览器每次向服务器验证；
						// 配置保存 → 版本号+1 → 缓存 key 变化 → 立即重新渲染，配置即时生效。
						"Cache-Control": "public, max-age=0, must-revalidate",
						"X-Firedre-Cache": "CACHE-HIT",
					},
				});
			}
		} catch {
			// 缓存不可用不影响主流程
		}
	}

	// HTML 缓存策略（配置即时生效 + 页面秒开）：
	// 1. Worker 内 Cache API 缓存 HTML，缓存 key 包含配置版本号；
	//    配置保存 → 版本号 +1 → 旧缓存 key 失效 → 下次请求重新渲染（配置立即生效）。
	// 2. 响应设 max-age=0+must-revalidate：浏览器每次回源验证；
	//    Cache API（key 含配置版本号）提供服务器端加速，配置保存 → 版本+1 → 旧 key 失效 → 即时生效。
	// 3. /admin、/api 不缓存（动态数据）。
	const response = await next();
	// 4. 保守安全响应头：避免 MIME 嗅探、点击劫持、Referrer 泄露。
	//    刻意不加严格 CSP——站点大量内联脚本（vditor/is:inline）依赖内联执行，
	//    过严 CSP 会破坏现有功能（故为 P2 而非 P1）。
	if (request.method === "GET") {
		response.headers.set("X-Content-Type-Options", "nosniff");
		response.headers.set("X-Frame-Options", "SAMEORIGIN");
		response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	}
	// 5. 后台页面显式 no-store：浏览器缓存旧 admin HTML 会引用已删除的 chunk（JS 失效 →
	//    侧栏链接全部整页跳转 → 重新检查会话 → 表现为"切换选项自动退出登录"）
	if (url.pathname.startsWith("/admin") && request.method === "GET") {
		response.headers.set("Cache-Control", "no-store");
	}
	if (request.method === "GET") {
		const contentType = response.headers.get("content-type") || "";
		const isCacheableHtml =
			contentType.includes("text/html") &&
			!url.pathname.startsWith("/admin") &&
			!url.pathname.startsWith("/api");
		// 只缓存 200 响应——错误响应(500/404)绝不入缓存，否则瞬时故障会被永久命中
		if (isCacheableHtml && htmlCacheKey && response.status === 200) {
			response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
			try {
				const html = await response.clone().text();
				if (html.length > 500 && html.length < 900_000) {
					// Cache API 需存储 Response 对象；设置相对 TTL 由 Cloudflare 缓存策略管理
					await caches.default.put(htmlCacheKey, new Response(html));
				}
			} catch {
				/* 缓存失败不影响响应 */
			}
		}
	}
	return response;
});
