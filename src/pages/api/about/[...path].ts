import type { APIRoute } from "astro";
import { getAbout, upsertAbout } from "../../../../server/about/service";
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

		const about = await getAbout(cfEnv, { includeSource: true });
		if (!about) return json({ message: "关于页数据不存在" }, 404);
		return json(about);
	} catch (error) {
		return fromServiceError(error);
	}
};

export const PUT: APIRoute = withAdmin(async ({ request }) => {
	const body = await request.text();
	if (!body.trim()) return badRequest("内容不能为空");
	const result = await upsertAbout(cfEnv, body);
	return json({ ok: true, ...result });
});

export const ALL: APIRoute = async () => methodNotAllowed();
