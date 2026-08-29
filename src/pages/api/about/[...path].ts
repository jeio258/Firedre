import type { APIRoute } from "astro";
import { getAbout, upsertAbout } from "../../../../server/about/service";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
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
		const about = await getAbout(cfEnv);
		if (!about) return json({ message: "关于页数据不存在" }, 404);
		return json(about);
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
		const result = await upsertAbout(cfEnv, body);
		return json({ ok: true, ...result });
	} catch (error) {
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();
