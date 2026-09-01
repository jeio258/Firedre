import type { APIRoute } from "astro";
import { splitMarkdown } from "../../../../server/posts/frontmatter";
import { renderMarkdown } from "../../../../server/posts/render";
import {
	badRequest,
	cfEnv,
	json,
	notFound,
	serverError,
} from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	if (segments.length !== 1) return badRequest("路径无效");

	const name = decodeURIComponent(segments[0]);
	if (!/^[a-zA-Z0-9._-]+$/.test(name)) return badRequest("路径无效");

	try {
		const object = await cfEnv.BUCKET.get(`spec/${name}.md`);
		if (!object) return notFound("页面不存在");
		const source = await object.text();
		const { frontmatter, content } = splitMarkdown(source);
		const rendered = await renderMarkdown(content, { frontmatter });
		return json({
			name,
			frontmatter,
			html: rendered.html,
			source,
		});
	} catch (error) {
		return serverError(error);
	}
};
