import { redactSensitive } from "@server/settings/sensitive";
import {
	getAllSettings,
	getSettingsVersionCached,
} from "@server/settings/service";
import type { APIRoute } from "astro";
import { toClientSettings } from "@/utils/client-settings";
import { cfEnv, fromServiceError } from "../../../lib/api";

export const prerender = false;

/** 客户端设置实时感知端点：版本号 + 客户端设置（脱敏后；本就随页面 HTML 注入，无新增暴露面） */
export const GET: APIRoute = async () => {
	try {
		const version = await getSettingsVersionCached(cfEnv);
		const all = await getAllSettings(cfEnv);
		const settings = toClientSettings(redactSensitive(all));
		return new Response(JSON.stringify({ version, settings }), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		return fromServiceError(error);
	}
};
