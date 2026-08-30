import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import { getLinks, upsertLinks } from "../../../../server/links/service";
import {
	badRequest,
	cfEnv,
	json,
	methodNotAllowed,
	serverError,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async () => {
	try {
		const links = await getLinks(cfEnv);
		if (!links) return json({ message: "友链数据不存在" }, 404);
		return json(links);
	} catch (error) {
		return serverError(error);
	}
};

export const PUT: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const body = await request.text();
		if (!body.trim()) return badRequest("内容不能为空");
		const result = await upsertLinks(cfEnv, body);
		return json({ ok: true, ...result });
	} catch (error) {
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();
