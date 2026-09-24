import { getSpecPage, isValidSpecName } from "@server/spec/service";
import type { APIRoute } from "astro";
import {
	badRequest,
	cfEnv,
	json,
	methodNotAllowed,
	notFound,
	serverError,
} from "../../../lib/api";
import { pathSegments } from "../../../lib/routePath";

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

export const ALL: APIRoute = async () => methodNotAllowed(["GET"]);
