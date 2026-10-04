import { redactSensitive } from "@server/settings/sensitive";
import {
	getAllSettings,
	getSettingsVersionCached,
} from "@server/settings/service";
import type { APIRoute } from "astro";
import { toClientSettings } from "@/utils/client-settings";
import { cfEnv, fromServiceError, methodNotAllowed } from "../../../lib/api";

export const prerender = false;

// 隔离级设置负载缓存：以版本号为键（版本变化即失效），TTL 兜底直改 D1 不 bump 的场景。
// 与 middleware 的 __FIREDRE_SETTINGS_CACHE__ 同模式；settings-live 每次软导航/回前台
// 都会打本端点，避免每请求全表 D1 读
const g = globalThis as unknown as {
	__FIREDRE_CLIENT_SETTINGS_CACHE__?: {
		version: string;
		payload: string;
		at: number;
	};
};
const CACHE_TTL_MS = 30_000;

/** 客户端设置实时感知端点：版本号 + 客户端设置（脱敏后；本就随页面 HTML 注入，无新增暴露面） */
export const GET: APIRoute = async () => {
	try {
		const version = await getSettingsVersionCached(cfEnv);
		const cached = g.__FIREDRE_CLIENT_SETTINGS_CACHE__;
		let payload: string;
		if (
			cached &&
			cached.version === version &&
			Date.now() - cached.at < CACHE_TTL_MS
		) {
			payload = cached.payload;
		} else {
			const all = await getAllSettings(cfEnv);
			const settings = toClientSettings(redactSensitive(all));
			payload = JSON.stringify({ version, settings });
			g.__FIREDRE_CLIENT_SETTINGS_CACHE__ = {
				version,
				payload,
				at: Date.now(),
			};
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
