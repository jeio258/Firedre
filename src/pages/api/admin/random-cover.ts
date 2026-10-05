import { verifyAdminRequest } from "@server/auth/adminSession";
import { getCoverConfig } from "@shared/config/runtime";
import type { APIRoute } from "astro";
import {
	cfEnv,
	json,
	methodNotAllowed,
	serverError,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

const FETCH_TIMEOUT_MS = 8000;

/**
 * 逐个尝试配置里的随机图 API，返回最终图片地址。
 * 必须服务端解析：部分图源（如 dmoe.cc）不返回 CORS 头，浏览器端 fetch 会被拦；
 * 302 跳转在服务端 follow 后可用 res.url 拿到最终地址。
 */
async function resolveRandomCover(urls: string[]): Promise<string> {
	for (const api of urls) {
		try {
			const res = await fetch(api, {
				redirect: "follow",
				headers: { Accept: "image/*,*/*;q=0.8" },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});
			const type = res.headers.get("content-type") || "";
			if (res.ok && type.startsWith("image/")) {
				res.body?.cancel();
				return res.url || api;
			}
			res.body?.cancel();
		} catch {
			// 该 API 不可用，试下一个
		}
	}
	return "";
}

/** 后台随机封面图：返回 { enable, url }；enable 决定编辑器写入主题魔法值 api 还是具体地址 */
export const GET: APIRoute = async ({ request, locals }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();
	try {
		const cover = getCoverConfig(locals);
		const randomCover = cover.randomCoverImage;
		const url = await resolveRandomCover(randomCover?.apis ?? []);
		return json({ enable: randomCover?.enable === true, url });
	} catch (error) {
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET"]);
