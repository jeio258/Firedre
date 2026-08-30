import type { APIRoute } from "astro";
import { getAbout, upsertAbout } from "../../../../server/about/service";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import {
	badRequest,
	cfEnv,
	fromServiceError,
	json,
	methodNotAllowed,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async () => {
	try {
		// includeSource:true → 返回 R2 原始 markdown（source 字段），后台编辑器
		// AdminContentEditor 读 data.source 展示/保存正文；否则 source 为 undefined
		// 导致“前台有内容、后台编辑器为空”。
		const about = await getAbout(cfEnv, { includeSource: true });
		if (!about) return json({ message: "关于页数据不存在" }, 404);
		return json(about);
	} catch (error) {
		return fromServiceError(error);
	}
};

export const PUT: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const body = await request.text();
		if (!body.trim()) return badRequest("内容不能为空");
		const result = await upsertAbout(cfEnv, body);
		return json({ ok: true, ...result });
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();
