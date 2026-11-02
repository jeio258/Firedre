// 原生评论 API（catch-all 按第一段分发）
//   GET  /api/comments/?target=&page=&pageSize=      前台列表
//   GET  /api/comments/admin/?status=&page=&pageSize= 后台列表（管理员）
//   POST /api/comments/                              提交（登录直发 / 匿名待审）
//   POST /api/comments/moderate/                     审核动作（管理员）

import { verifyAdminRequest } from "@server/auth/adminSession";
import { getAuthUser } from "@server/auth/userSession";
import {
	COMMENT_PAGE_SIZE,
	listComments,
	listCommentsForAdmin,
	type ModerateAction,
	moderateComment,
	submitComment,
} from "@server/comments/service";
import { getClientIp } from "@server/utils/clientIp";
import {
	isSameOriginRequest,
	originForbiddenResponse,
} from "@server/utils/csrf";
import { withRateLimit } from "@server/utils/rateLimiter";
import type { APIRoute } from "astro";
import {
	cfEnv,
	fromServiceError,
	json,
	methodNotAllowed,
	notFound,
	unauthorized,
} from "../../../lib/api";
import { pathSegments } from "../../../lib/routePath";

export const prerender = false;

const MODERATE_ACTIONS: ModerateAction[] = ["approve", "spam", "delete"];

// 响应内容随 Cookie 变化（登录者可读自己的 pending），必须显式 Vary，
// 否则 CDN 会把登录态响应复用给匿名访客
function jsonAuthVariant(data: unknown, authenticated: boolean) {
	const res = json(data, 200, authenticated ? "private" : "list");
	res.headers.set("Vary", "Cookie");
	return res;
}

export const GET: APIRoute = async ({ params, request, url }) => {
	const action = pathSegments(params)[0] || "";

	try {
		if (action === "admin") {
			if (!(await verifyAdminRequest(request, cfEnv))) return unauthorized();

			const result = await listCommentsForAdmin(cfEnv.DB, {
				status: url.searchParams.get("status") || "pending",
				page: Number(url.searchParams.get("page") || 1),
				pageSize: Number(url.searchParams.get("pageSize") || 20),
			});
			return json(result, 200, "private");
		}

		if (action) return notFound();

		const target = url.searchParams.get("target") || "";
		if (!target) return notFound("缺少 target");

		const me = await getAuthUser(request, cfEnv);
		const result = await listComments(cfEnv.DB, {
			target,
			page: Number(url.searchParams.get("page") || 1),
			pageSize: Number(url.searchParams.get("pageSize") || COMMENT_PAGE_SIZE),
			viewerId: me?.id ?? null,
		});
		// viewer 供前端表单渲染登录态（昵称/是否已验证），不包含邮箱等隐私字段
		return jsonAuthVariant(
			{
				...result,
				viewer: me
					? {
							id: me.id,
							name: me.name,
							avatar: me.avatar,
							emailVerified: Boolean(me.email_verified),
						}
					: null,
			},
			Boolean(me),
		);
	} catch (error) {
		return fromServiceError(error);
	}
};

export const POST: APIRoute = async ({ params, request }) => {
	const action = pathSegments(params)[0] || "";

	if (!isSameOriginRequest(request)) return originForbiddenResponse();

	try {
		if (action === "moderate") {
			if (!(await verifyAdminRequest(request, cfEnv))) return unauthorized();

			const body = (await request.json().catch(() => null)) as {
				id?: string;
				ids?: unknown;
				action?: string;
			} | null;
			if (
				!body?.action ||
				!MODERATE_ACTIONS.includes(body.action as ModerateAction)
			)
				return json({ message: "未知的审核动作" }, 400);

			// 批量通过（仅待审页使用）：逐条走同一状态机，保留各自的软删语义
			if (Array.isArray(body.ids)) {
				const ids = body.ids.map(String).filter(Boolean).slice(0, 100);
				if (!ids.length) return json({ message: "缺少评论 id" }, 400);
				let done = 0;
				for (const id of ids) {
					const r = await moderateComment(
						cfEnv.DB,
						id,
						body.action as ModerateAction,
					);
					if (r.ok) done += 1;
				}
				return json({ ok: true, count: done }, 200, "private");
			}

			if (!body?.id) return json({ message: "缺少评论 id" }, 400);
			const result = await moderateComment(
				cfEnv.DB,
				String(body.id),
				body.action as ModerateAction,
			);
			if (!result.ok) return notFound("评论不存在");
			return json(result, 200, "private");
		}

		if (action) return notFound();

		const me = await getAuthUser(request, cfEnv);

		if (me && !me.email_verified) {
			return json(
				{ message: "请先完成邮箱验证后再评论", needVerify: true },
				403,
			);
		}

		// 两档限流靠 maxRequests 并入 key，互不挤占同一窗口
		const limit = me
			? { windowMs: 10 * 60_000, maxRequests: 20, scope: "comment" }
			: {
					windowMs: 10 * 60_000,
					maxRequests: 3,
					scope: "comment",
					message: "评论过于频繁，请稍后再试",
				};

		return await withRateLimit(cfEnv, request, limit, async () => {
			const body = (await request.json().catch(() => null)) as {
				target?: string;
				content?: string;
				guestName?: string;
				guestEmail?: string;
				parentId?: string;
			} | null;
			if (!body) return json({ message: "请求体格式错误" }, 400);

			const outcome = await submitComment(
				cfEnv.DB,
				{
					target: String(body.target || ""),
					content: String(body.content || ""),
					guestName: body.guestName,
					guestEmail: body.guestEmail,
					parentId: body.parentId || null,
					ip: getClientIp(request),
				},
				me
					? {
							id: me.id,
							name: me.name,
							avatar: me.avatar,
						}
					: null,
			);

			return json(
				{
					ok: true,
					status: outcome.status,
					comment: outcome.comment,
					message:
						outcome.status === "approved"
							? "评论已发布"
							: "评论已提交，审核后展示",
				},
				200,
				"private",
			);
		});
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET", "POST"]);
