import type { APIRoute } from "astro";
import type { CloudflareEnv } from "../../../../types/env";
import type { LinksFrontmatter } from "../../../../types/links";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import {
	getLinks,
	upsertLinks,
} from "../../../../server/links/service";
import { LINKS_R2_KEY } from "../../../../server/links/constants";
import {
	parseLinksSource,
	serializeLinksFrontmatter,
} from "../../../../server/links/frontmatter";
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
		const links = await getLinks(cfEnv, { includeSource: true });
		if (!links) return json({ message: "友链数据不存在" }, 404);
		return json(links);
	} catch (error) {
		return serverError(error);
	}
};

async function env_BUCKET_getContent(
	env: CloudflareEnv,
): Promise<{ content: string } | null> {
	const object = await env.BUCKET.get(LINKS_R2_KEY);
	if (!object) return null;
	const source = await object.text();
	const { content } = parseLinksSource(source);
	return { content };
}

export const PUT: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const contentType = request.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			// 结构化友链编辑器：接收 linkGroups JSON，序列化为 markdown 写入 R2
			const body = (await request.json()) as {
				linkGroups?: unknown;
			};
			if (!Array.isArray(body?.linkGroups)) {
				return badRequest("linkGroups 必须是非空数组");
			}
			// 保留现有页面自定义正文（可视化编辑器只编辑卡片，不编辑正文）
			let content = "";
			const existing = await env_BUCKET_getContent(cfEnv);
			if (existing) content = existing.content;
			const frontmatter: LinksFrontmatter = {
				linkGroups: body.linkGroups as LinksFrontmatter["linkGroups"],
			};
			const source = serializeLinksFrontmatter(frontmatter, content);
			const result = await upsertLinks(cfEnv, source);
			return json({ ok: true, ...result });
		}

		// 原始 markdown 编辑器（about 等）
		const bodyText = await request.text();
		if (!bodyText.trim()) return badRequest("内容不能为空");
		const result = await upsertLinks(cfEnv, bodyText);
		return json({ ok: true, ...result });
	} catch (error) {
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();
