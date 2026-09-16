import type { APIRoute } from "astro";
import { pathSegments } from "../../../lib/routePath";
import { getSpecPage, isValidSpecName } from "../../../../server/spec/service";
import {
	badRequest,
	cfEnv,
	json,
	notFound,
	serverError,
} from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const segments = pathSegments(params);
	if (segments.length !== 1) return badRequest("路径无效");

	const name = decodeURIComponent(segments[0]);
	if (!isValidSpecName(name)) return badRequest("路径无效");

	try {
		const page = await getSpecPage(cfEnv, name);
		if (!page) return notFound("页面不存在");
		return json(page);
	} catch (error) {
		return serverError(error);
	}
};
