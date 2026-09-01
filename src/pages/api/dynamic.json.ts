import type { APIRoute } from "astro";
import { getAllDynamics } from "../../../server/dynamic/service";
import { cfEnv, fromServiceError } from "../../lib/api";

export const prerender = false;

export const GET: APIRoute = async () => {
	try {
		const items = await getAllDynamics(cfEnv);
		return new Response(JSON.stringify(items), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=0, must-revalidate",
			},
		});
	} catch (error) {
		return fromServiceError(error);
	}
};
