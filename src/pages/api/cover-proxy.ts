import { withRateLimit } from "@server/utils/rateLimiter";
import { isSafeProxyTarget, resolveSafeRedirect } from "@server/utils/safeUrl";
import type { APIRoute } from "astro";
import { cfEnv, methodNotAllowed } from "../../lib/api";

export const prerender = false;

// 重定向最大跳数：超出即放弃（→ 502），避免重定向环
const MAX_REDIRECTS = 3;

// 上游回源超时：移动端弱网下 10s 会长期占住 Worker 并发槽位（首页多张封面并行取图，
// 一张慢图能把队列拖到 LCP 数秒），6s 后快速 502 让前端 CoverImage 兜底换图
const UPSTREAM_TIMEOUT_MS = 6_000;

// 远程封面同源代理：按宽度请求 Cloudflare 图像缩放；缩放不可用时透传原图，失败时 302 回退原图
export const GET: APIRoute = async ({ request }) => {
	const url = new URL(request.url);
	const raw = url.searchParams.get("u");
	if (!raw) return new Response("Bad Request", { status: 400 });

	let target: URL;
	try {
		target = new URL(raw);
	} catch {
		return new Response("Bad Request", { status: 400 });
	}
	// 仅代理 https 外链，且不允许代理本站
	if (target.protocol !== "https:" || target.hostname === url.hostname) {
		return new Response("Bad Request", { status: 400 });
	}
	// SSRF 防护：拒绝私网/环回/链路本地/保留目标与保留 TLD（公网图片主机不受影响）
	if (!isSafeProxyTarget(target)) {
		return new Response("Forbidden target", { status: 400 });
	}

	const width = Math.min(
		Math.max(Math.trunc(Number(url.searchParams.get("w"))) || 828, 64),
		1920,
	);

	// 显式格式参数（opt-in）：f=webp|avif 时让 CF 图像缩放输出该格式；不传则维持原行为
	// （壁纸用 f=webp 减重 ~50%；封面不传 → 完全不变）
	const requestedFormat = url.searchParams.get("f");
	const imageFormat =
		requestedFormat === "avif" || requestedFormat === "webp"
			? requestedFormat
			: "auto";
	// 各格式独立缓存键，避免不同格式互相覆盖
	const cacheKey = new Request(
		`${request.url}${request.url.includes("?") ? "&" : "?"}__fmt=${imageFormat}`,
		request,
	);

	// 安全：上游失败/非图片时不 302 回退到用户可控 URL（开放重定向/钓鱼面），
	// 改返回固定内容的中性灰占位 SVG——壁纸等无前端兜底的消费点不再空白；
	// CoverImage 的 apiUrls 换源重试依赖 img error 触发，随机封面（image==="api"）模式下
	// 该路径会被占位短路，属已接受的取舍（备用 API 直连慢网下同样可能挂）
	const PLACEHOLDER_SVG =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9">' +
		'<rect width="16" height="9" fill="#d4d4d8"/>' +
		'<path d="M0 9 L5.5 3.5 L8.5 6.5 L11 4.5 L16 9 Z" fill="#c4c6cb"/>' +
		"</svg>";
	// 短 TTL：占位是暂态，图床恢复后几分钟内自愈；不写 caches.default（仅成功路径 put）
	const placeholderResponse = () =>
		new Response(PLACEHOLDER_SVG, {
			status: 200,
			headers: {
				"content-type": "image/svg+xml",
				"cache-control": "public, max-age=300, stale-while-revalidate=3600",
			},
		});

	// 项目全局类型中 caches.default 仅声明 match/put
	type ProxyCache = {
		match(req: Request): Promise<Response | undefined>;
		put(req: Request, resp: Response): Promise<void>;
	};
	let cache: ProxyCache | null = null;
	try {
		cache = (globalThis as unknown as { caches: { default: ProxyCache } })
			.caches.default;
		const cached = await cache.match(cacheKey);
		if (cached) {
			// cache.match 返回的 Response headers 不可变，外层 middleware 需要追加安全头，需重建
			return new Response(cached.body, {
				status: cached.status,
				headers: cached.headers,
			});
		}
	} catch {
		cache = null;
	}

	// 开放中继防护：缓存命中已直接返回，仅上游取图计入限流；failOpen 保证可用性优先
	return withRateLimit(
		cfEnv,
		request,
		{
			windowMs: 60_000,
			maxRequests: 120,
			scope: "cover-proxy",
			failOpen: true,
		},
		async () => {
			try {
				// 逐跳跟随 + 每跳校验：默认跟随（redirect:follow）会被 302 指向私网/元数据地址，
				// 从而绕过上面的初始主机校验；但也不能一律 fail-closed——图源常返回**相对**
				// Location（如 t.alcy.cc → /pic/pc/548.webp），必须解析后跟随。
				let current = target;
				let upstream: Response | null = null;
				for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
					const res = await fetch(current, {
						headers: {
							"user-agent": "Mozilla/5.0 (compatible; FiredreCoverProxy/1.0)",
						},
						cf: {
							image: { width, quality: 80, format: imageFormat },
							cacheTtl: 86400,
						},
						redirect: "manual",
						signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
					} as RequestInit);
					if (res.status < 300 || res.status >= 400) {
						upstream = res;
						break;
					}
					const location = res.headers.get("location");
					if (!location) break;
					const next = resolveSafeRedirect(current, location);
					if (!next) break; // 目标不安全或非 https → 不跟随
					current = next;
				}
				if (!upstream) return placeholderResponse();
				const contentType = upstream.headers.get("content-type") || "";
				if (
					!upstream.ok ||
					!upstream.body ||
					!contentType.startsWith("image/")
				) {
					return placeholderResponse();
				}
				const headers = new Headers();
				headers.set("content-type", contentType);
				// 浏览器 1h、边缘 1 天：随机壁纸需要保留换图节奏，不能按天粘住；
				// 过期后 stale-while-revalidate 先回旧图、后台再验证，避免首屏无图
				headers.set(
					"cache-control",
					"public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
				);
				const resp = new Response(upstream.body, { headers });
				if (cache) {
					try {
						await cache.put(cacheKey, resp.clone());
					} catch {
						// 缓存写入失败仍返回图片
					}
				}
				return resp;
			} catch {
				return placeholderResponse();
			}
		},
	);
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET"]);
