import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import { decodePostSlug, isValidPostSlug } from "../../../../server/posts/frontmatter";
import {
	deletePost,
	getPostBySlug,
	getPostNeighbors,
	getTaxonomyArchives,
	getTaxonomyCategories,
	getTaxonomyTags,
	listPosts,
	searchPosts,
	upsertPost,
} from "../../../../server/posts/service";
import { withRateLimit } from "../../../../server/utils/rateLimiter";
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

/**
 * 移除公开响应中的敏感字段（加密文章明文密码/密码提示）。
 * 密码仅在服务端用于 AES 加密内容，绝不下发给未认证访问者。
 *
 * 对加密文章（password 非空）额外剔除渲染后的明文正文（html/headings）
 * 与源码（source/markdown），避免未认证调用者绕过密码保护直接读取明文。
 */
function redactPostSecrets<T>(post: T): T {
	const copy = { ...(post as Record<string, unknown>) };
	const isEncrypted = Boolean(
		copy.password ?? (copy as { frontmatter?: { password?: unknown } }).frontmatter?.password,
	);
	delete copy.password;
	delete copy.passwordHint;
	if (copy.frontmatter && typeof copy.frontmatter === "object") {
		const fm = { ...(copy.frontmatter as Record<string, unknown>) };
		delete fm.password;
		delete fm.passwordHint;
		copy.frontmatter = fm;
	}
	if (isEncrypted) {
		// 加密文章正文必须以密文形式下发（由 EncryptedContent 在 SSR 时加密），
		// API 不返回明文 html/headings/source/markdown。
		delete copy.html;
		delete copy.headings;
		delete copy.source;
		delete copy.markdown;
	}
	return copy as T;
}

export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const url = new URL(request.url);
	const isAdmin = await verifyAdminRequest(request, cfEnv);

	try {
		if (segments[0] === "taxonomy" && segments.length >= 2) {
			const kind = segments[1];
			if (kind === "categories")
				return json({ categories: await getTaxonomyCategories(cfEnv) });
			if (kind === "tags") return json({ tags: await getTaxonomyTags(cfEnv) });
			if (kind === "archives")
				return json({ months: await getTaxonomyArchives(cfEnv) });
			return notFound();
		}

		if (segments.length === 0) {
			const result = await listPosts(cfEnv, {
				page: Number(url.searchParams.get("page") || 1),
				pageSize: Number(url.searchParams.get("pageSize") || 100),
				category: url.searchParams.get("category") || undefined,
				tag: url.searchParams.get("tag") || undefined,
				month: url.searchParams.get("month") || undefined,
				includeUnpublished: isAdmin,
			});
			if (!isAdmin) result.posts = result.posts.map(redactPostSecrets);
			return json(result, 200, isAdmin ? "private" : "list");
		}

		if (segments[0] === "search") {
			const q = url.searchParams.get("q") || "";
			const posts = await searchPosts(
				cfEnv,
				q,
				Number(url.searchParams.get("limit") || 20),
			);
			return json({ posts: isAdmin ? posts : posts.map(redactPostSecrets) });
		}

		if (segments[0] === "neighbors" && segments[1]) {
			if (!isValidPostSlug(decodePostSlug(segments[1])))
				return badRequest("文章 slug 格式无效");
			const neighbors = await getPostNeighbors(cfEnv, segments[1]);
			if (!isAdmin) {
				neighbors.prev = neighbors.prev ? redactPostSecrets(neighbors.prev) : null;
				neighbors.next = neighbors.next ? redactPostSecrets(neighbors.next) : null;
			}
			return json(neighbors, 200, "list");
		}

		const slug = segments[0];
		if (!slug) return notFound();

		if (!isValidPostSlug(decodePostSlug(slug)))
			return badRequest("文章 slug 格式无效");

		const post = await getPostBySlug(cfEnv, slug, {
			includeUnpublished: isAdmin,
			includeSource: isAdmin,
		});
		if (!post) return notFound("文章不存在");
		return json(
			isAdmin ? post : redactPostSecrets(post),
			200,
			isAdmin ? "private" : "default",
		);
	} catch (error) {
		return fromServiceError(error);
	}
};

export const PUT: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const slug = segments[0];
	if (!slug || !isValidPostSlug(decodePostSlug(slug)))
		return badRequest("文章 slug 格式无效");

	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	// 写入操作限流：每分钟最多 10 次（D1 持久化，跨边缘节点一致）
	return withRateLimit(
		cfEnv,
		request,
		{ windowMs: 60_000, maxRequests: 10, scope: "posts-write" },
		async () => {
			try {
				const body = await request.text();
				if (!body.trim()) return badRequest("正文不能为空");
				const result = await upsertPost(cfEnv, slug, body);
				return json({ ok: true, ...result });
			} catch (error) {
				return fromServiceError(error);
			}
		},
	);
};

export const DELETE: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const slug = segments[0];
	if (!slug || !isValidPostSlug(decodePostSlug(slug)))
		return badRequest("文章 slug 格式无效");

	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	// 删除操作限流：每分钟最多 5 次（D1 持久化）
	return withRateLimit(
		cfEnv,
		request,
		{ windowMs: 60_000, maxRequests: 5, scope: "posts-write" },
		async () => {
			try {
				const ok = await deletePost(cfEnv, slug);
				if (!ok) return notFound("文章不存在");
				return json({ ok: true });
			} catch (error) {
				return fromServiceError(error);
			}
		},
	);
};

export const ALL: APIRoute = async () => methodNotAllowed();
