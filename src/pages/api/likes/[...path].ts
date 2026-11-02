import { getAuthUser } from "@server/auth/userSession";
import { getLikeState, toggleLike } from "@server/likes/service";
import { isSameOriginRequest } from "@server/utils/csrf";
import { withRateLimit } from "@server/utils/rateLimiter";
import type { APIRoute } from "astro";
import {
	cfEnv,
	fromServiceError,
	json,
	methodNotAllowed,
} from "../../../lib/api";
import { pathSegments } from "../../../lib/routePath";

export const prerender = false;

export const GET: APIRoute = async ({ params, request, url }) => {
	if (pathSegments(params).length > 0)
		return json({ message: "Not found" }, 404);

	const slug = url.searchParams.get("slug") || "";
	if (!slug) return json({ message: "缺少 slug" }, 400);

	try {
		const me = await getAuthUser(request, cfEnv);
		const state = await getLikeState(cfEnv.DB, slug, me?.id ?? null);
		const res = json(
			{ ...state, authenticated: Boolean(me) },
			200,
			me ? "private" : "default",
		);
		// 匿名响应仍随 Cookie 变化（liked 恒 false 但登录后会变），禁止 CDN 跨用户复用
		if (!me) res.headers.set("Vary", "Cookie");
		return res;
	} catch (error) {
		return fromServiceError(error);
	}
};

export const POST: APIRoute = async ({ params, request }) => {
	if (!isSameOriginRequest(request))
		return json({ message: "跨站请求被拒绝" }, 403);
	if (pathSegments(params).length > 0)
		return json({ message: "Not found" }, 404);

	try {
		const me = await getAuthUser(request, cfEnv);
		if (!me) return json({ message: "请先登录", needLogin: true }, 401);
		if (!me.email_verified)
			return json(
				{ message: "请先完成邮箱验证后再点赞", needVerify: true },
				403,
			);

		return await withRateLimit(
			cfEnv,
			request,
			{ windowMs: 60_000, maxRequests: 60, scope: "post-like" },
			async () => {
				const body = (await request.json().catch(() => null)) as {
					slug?: unknown;
				} | null;
				const slug = typeof body?.slug === "string" ? body.slug : "";
				if (!slug) return json({ message: "缺少 slug" }, 400);

				const state = await toggleLike(cfEnv.DB, slug, me.id);
				return json(state, 200, "private");
			},
		);
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET", "POST"]);
