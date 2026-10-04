import { redactSensitive } from "@server/settings/sensitive";
import {
	getAllSettings,
	getSettingsVersionCached,
} from "@server/settings/service";
import {
	readIsolateCache,
	writeIsolateCache,
} from "@server/utils/isolateCache";
import type { APIRoute } from "astro";
import { toClientSettings } from "@/utils/client-settings";
import { cfEnv, fromServiceError, methodNotAllowed } from "../../../lib/api";

export const prerender = false;

// 隔离级设置负载缓存：以版本号为键（版本变化即失效），TTL 兜底直改 D1 不 bump 的场景。
// settings-live 每次软导航/回前台都会打本端点，避免每请求全表 D1 读
const CACHE_SLOT = "api.settingsClient";

/** 客户端设置实时感知端点：版本号 + 客户端设置（脱敏后；本就随页面 HTML 注入，无新增暴露面） */
export const GET: APIRoute = async () => {
	try {
		const version = await getSettingsVersionCached(cfEnv);
		let payload = readIsolateCache<string>(CACHE_SLOT, version);
		if (payload === undefined) {
			const all = await getAllSettings(cfEnv);
			const settings = toClientSettings(redactSensitive(all));
			payload = JSON.stringify({ version, settings });
			writeIsolateCache(CACHE_SLOT, version, payload);
		}
		return new Response(payload, {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET"]);
