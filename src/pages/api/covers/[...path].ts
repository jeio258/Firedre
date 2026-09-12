import type { APIRoute } from "astro";
import { pathSegments } from "../../../lib/routePath";
import { cfEnv, serverError } from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	try {
		const segments = pathSegments(params);
		if (segments.length < 2) return new Response("Bad Request", { status: 400 });

		const slug = segments[0];
		const file = segments.slice(1).join("/");
		if (slug.includes("..") || file.includes("..") || file.includes("\\"))
			return new Response("Bad Request", { status: 400 });

		const key = `covers/${slug}/${file}`;
		const object = await cfEnv.BUCKET.get(key);
		if (!object) return new Response("Not Found", { status: 404 });

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set(
			"Cache-Control",
			"public, max-age=86400, stale-while-revalidate=604800",
		);

		return new Response(object.body, { headers });
	} catch (error) {
		return serverError(error);
	}
};
