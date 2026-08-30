import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import {
	clearHtmlFiles,
	deleteHtmlFile,
	getHtmlFile,
	listHtmlFiles,
	upsertHtmlFile,
} from "../../../../server/htmlFiles/service";
import {
	badRequest,
	cfEnv,
	fromServiceError,
	json,
	methodNotAllowed,
	notFound,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const isAdmin = await verifyAdminRequest(request, cfEnv);

	try {
		if (segments.length === 0) {
			const files = await listHtmlFiles(cfEnv);
			return json({ files }, 200, isAdmin ? "private" : "list");
		}

		const file = await getHtmlFile(cfEnv, decodeURIComponent(segments[0]));
		if (!file) return notFound("文件不存在");
		return json(file, 200, isAdmin ? "private" : "default");
	} catch (error) {
		return fromServiceError(error);
	}
};

export const PUT: APIRoute = async ({ params: _params, request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const body = (await request.json().catch(() => null)) as {
			slug?: string;
			title?: string;
			description?: string;
			content?: string;
		} | null;
		if (!body) return badRequest("请求体无效");

		const payload = {
			slug: String(body.slug || ""),
			title: String(body.title || ""),
			description: String(body.description || ""),
			content: String(body.content || ""),
		};
		const file = await upsertHtmlFile(cfEnv, payload);
		return json({ ok: true, file });
	} catch (error) {
		return fromServiceError(error);
	}
};

export const DELETE: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);

	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		// 无文件名 => 清空全部 HTML 文件
		if (segments.length === 0) {
			const cleared = await clearHtmlFiles(cfEnv);
			return json({ ok: true, cleared });
		}

		const slug = segments[0];
		if (!slug) return badRequest("缺少文件名");

		const ok = await deleteHtmlFile(cfEnv, decodeURIComponent(slug));
		if (!ok) return notFound("文件不存在");
		return json({ ok: true });
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();
