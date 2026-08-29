import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import {
	deleteDynamic,
	listDynamics,
	upsertDynamic,
} from "../../../../server/dynamic/service";
import {
	badRequest,
	cfEnv,
	json,
	methodNotAllowed,
	serverError,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const url = new URL(request.url);

	try {
		if (segments.length === 0) {
			const page = Number(url.searchParams.get("page") || 1);
			const pageSize = Number(url.searchParams.get("pageSize") || 100);
			const result = await listDynamics(cfEnv, { page, pageSize });
			return json(result, 200, "list");
		}
		return json({ message: "Not found" }, 404);
	} catch (error) {
		return serverError(error);
	}
};

export const POST: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const body = (await request.json().catch(() => null)) as {
			id?: string;
			content?: string;
			published?: number;
			pinned?: boolean;
			location?: string;
		} | null;
		if (!body || !String(body.content || "").trim())
			return badRequest("动态内容不能为空");

		const id = String(body.id || "").trim() || `dyn-${Date.now()}`;
		const result = await upsertDynamic(cfEnv, id, {
			content: String(body.content),
			published: body.published ? Number(body.published) : Date.now(),
			pinned: body.pinned === true,
			location: String(body.location || ""),
		});
		return json({ ok: true, ...result });
	} catch (error) {
		return serverError(error);
	}
};

export const DELETE: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const id = segments[0];
	if (!id) return badRequest("缺少动态 ID");

	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const ok = await deleteDynamic(cfEnv, decodeURIComponent(id));
		if (!ok) return json({ message: "动态不存在" }, 404);
		return json({ ok: true });
	} catch (error) {
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();
