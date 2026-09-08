import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import {
	getAllSettings,
	getSettingsGroup,
	saveSettingsGroups,
	SETTING_GROUPS,
	saveSettingsGroup,
	type SettingGroup,
} from "../../../../server/settings/service";
import { redactSensitive } from "../../../../server/settings/sensitive";
import {
	badRequest,
	cfEnv,
	json,
	serverError,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
	try {
		const isAdmin = await verifyAdminRequest(request, cfEnv);
		const { flattenSettingsDefaults } = await import("../../../../server/settings/flatten");
		const defaults = flattenSettingsDefaults();
		const group = url.searchParams.get("group");
		if (group && (SETTING_GROUPS as readonly string[]).includes(group)) {
			const db = await getSettingsGroup(cfEnv, group as never);
			const payload = { ...(defaults[group] ?? {}), ...db };
			return json(
				isAdmin ? payload : redactSensitive(payload),
				200,
				"private",
			);
		}
		const all = await getAllSettings(cfEnv);
		const merged: Record<string, Record<string, unknown>> = {};
		for (const key of SETTING_GROUPS) {
			merged[key] = { ...(defaults[key] ?? {}), ...(all[key] ?? {}) };
		}
		return json(isAdmin ? merged : redactSensitive(merged), 200, "private");
	} catch (error) {
		return serverError(error);
	}
};

export const PUT: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	// 设置修改限流：每分钟最多 20 次（D1 持久化）
	return (await import("../../../../server/utils/rateLimiter")).withRateLimit(
		cfEnv,
		request,
		{ windowMs: 60_000, maxRequests: 20, scope: "settings-write" },
		async () => {
			try {
				const body = (await request.json().catch(() => null)) as Record<
					string,
					unknown
				> | null;
				if (!body || typeof body !== "object") return badRequest("请求体无效");

				if (body.groups && typeof body.groups === "object") {
					const groups = body.groups as Record<
						string,
						Record<string, unknown>
					>;
					const valid: Record<string, Record<string, unknown>> = {};
					for (const [key, data] of Object.entries(groups)) {
						if (!(SETTING_GROUPS as readonly string[]).includes(key)) continue;
						if (typeof data !== "object" || data === null) continue;
						valid[key] = data;
					}
					// 聚合为单次批量写入，避免 31 组串行全量读写导致保存耗时 ~6s
					await saveSettingsGroups(
						cfEnv,
						valid as Record<SettingGroup, Record<string, unknown>>,
					);
					return json({ ok: true });
				}

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
