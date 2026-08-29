import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import {
	getAllSettings,
	getSettingsGroup,
	SETTING_GROUPS,
	saveSettingsGroup,
} from "../../../../server/settings/service";
import {
	badRequest,
	cfEnv,
	json,
	serverError,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

/** GET /api/settings/ 公开读取全部配置（后台展示 = 静态真实默认 + 已保存覆盖） */
export const GET: APIRoute = async ({ url }) => {
	try {
		const { flattenSettingsDefaults } = await import("../../../../server/settings/flatten");
		const defaults = flattenSettingsDefaults();
		const group = url.searchParams.get("group");
		if (group && (SETTING_GROUPS as readonly string[]).includes(group)) {
			const db = await getSettingsGroup(cfEnv, group as never);
			return json({ ...(defaults[group] ?? {}), ...db }, 200, "private");
		}
		const all = await getAllSettings(cfEnv);
		const merged: Record<string, Record<string, unknown>> = {};
		for (const key of SETTING_GROUPS) {
			merged[key] = { ...(defaults[key] ?? {}), ...(all[key] ?? {}) };
		}
		return json(merged, 200, "private");
	} catch (error) {
		return serverError(error);
	}
};

/** PUT /api/settings/ 需登录；body: { group: string, data: object } 或整组扁平 */
export const PUT: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	// 设置修改限流：每分钟最多 20 次（D1 持久化）
	return (await import("../../../../server/utils/rateLimiter")).withRateLimit(
		cfEnv,
		request,
		{ windowMs: 60_000, maxRequests: 20 },
		async () => {
			try {
				const body = (await request.json().catch(() => null)) as Record<
					string,
					unknown
				> | null;
				if (!body || typeof body !== "object") return badRequest("请求体无效");

				// 批量格式：{ groups: Record<group, data> } 一次保存多组
				if (body.groups && typeof body.groups === "object") {
					const groups = body.groups as Record<string, Record<string, unknown>>;
					for (const [key, data] of Object.entries(groups)) {
						if (!(SETTING_GROUPS as readonly string[]).includes(key)) continue;
						if (typeof data !== "object" || data === null) continue;
						await saveSettingsGroup(cfEnv, key as never, data);
					}
					return json({ ok: true });
				}

				// 新格式：{ group, data } 保存单组
				if (
					typeof body.group === "string" &&
					(SETTING_GROUPS as readonly string[]).includes(body.group)
				) {
					const data = (body.data ?? {}) as Record<string, unknown>;
					if (typeof data !== "object" || data === null)
						return badRequest("data 无效");
					await saveSettingsGroup(cfEnv, body.group as never, data);
					return json({ ok: true });
				}

				// 旧格式：扁平 SiteSettings → basic 组。
				// 仅接受标量值（拒绝嵌套对象），避免畸形请求（如 {"basic":{...}}）整体写入 basic 组污染配置。
				const isFlat =
					Object.keys(body).length > 0 &&
					Object.values(body).every(
						(v) => v === null || typeof v !== "object",
					);
				if (isFlat) {
					await saveSettingsGroup(
						cfEnv,
						"basic",
						body as Record<string, unknown>,
					);
					return json({ ok: true });
				}
				return badRequest("请求体格式无效：需 { group, data }、{ groups } 或扁平字段");
			} catch (error) {
				return serverError(error);
			}
		},
	);
};
