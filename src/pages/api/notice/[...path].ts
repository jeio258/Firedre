import type { APIRoute } from "astro";
import { getNotice, upsertNotice } from "../../../../server/notice/service";
import {
	badRequest,
	cfEnv,
	fromServiceError,
	json,
	methodNotAllowed,
	withAdmin,
} from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async () => {
	try {
		const notice = await getNotice(cfEnv);
		if (!notice) return json({ message: "公告不存在" }, 404);
		return json(notice);
	} catch (error) {
		return fromServiceError(error);
	}
};

export const PUT: APIRoute = withAdmin(async ({ request }) => {
	const raw = await request.text();
	if (!raw.trim()) return badRequest("内容不能为空");
	const result = await upsertNotice(cfEnv, raw);
	return json({ ok: true, ...result });
});

export const ALL: APIRoute = async () => methodNotAllowed();
