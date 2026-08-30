import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import { getNotice, upsertNotice } from "../../../../server/notice/service";
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
		const notice = await getNotice(cfEnv);
		if (!notice) return json({ message: "公告不存在" }, 404);
		return json(notice);
	} catch (error) {
		return fromServiceError(error);
	}
};

export const PUT: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const raw = await request.text();
		if (!raw.trim()) return badRequest("内容不能为空");
		const result = await upsertNotice(cfEnv, raw);
		return json({ ok: true, ...result });
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();
