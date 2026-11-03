import type { BackendActor } from "@server/auth/perms";
import { resolveBackendActor } from "@server/auth/perms";
import { decodePostSlug, isValidPostSlug } from "@server/posts/frontmatter";
import { redactPostSecrets } from "@server/posts/sanitize";
import {
	deletePost,
	getPostBySlug,
	getPostNeighbors,
	getPostOwner,
	getTaxonomyArchives,
	getTaxonomyCategories,
	getTaxonomyTags,
	listPosts,
	searchPosts,
	upsertPost,
} from "@server/posts/service";
import { withRateLimit } from "@server/utils/rateLimiter";
import type { APIRoute } from "astro";
import {
	badRequest,
	cfEnv,
	fromServiceError,
	json,
	methodNotAllowed,
	notFound,
	unauthorized,
} from "../../../lib/api";
import { pathSegments } from "../../../lib/routePath";

export const prerender = false;

// 归属判定：非站长的 post:create 持有者只能操作自己的文章。
// author_id 为 NULL（历史回填时无 admin 用户/旧版会话创建）视同站长所有。
function isOwnerAuthor(actor: BackendActor) {
	return (
		!actor.isAdmin && Boolean(actor.user) && actor.perms.includes("post:create")
	);
}

export const GET: APIRoute = async ({ params, request }) => {
	const segments = pathSegments(params);
	const url = new URL(request.url);

	try {
		const actor = await resolveBackendActor(request, cfEnv);
		const isAdmin = Boolean(actor?.isAdmin);
		const isAuthor = actor ? isOwnerAuthor(actor) : false;
		const authorId = isAuthor ? actor!.user!.id : undefined;

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
			// mine=1：后台列表请求；非站长作者只见自己的文章（含草稿）。
			// 无 mine 时保持公开语义——作者浏览前台列表不受归属过滤影响
			const mine = url.searchParams.get("mine") === "1" && isAuthor;
			const result = await listPosts(cfEnv, {
				page: Number(url.searchParams.get("page") || 1),
				pageSize: Number(url.searchParams.get("pageSize") || 100),
				category: url.searchParams.get("category") || undefined,
				tag: url.searchParams.get("tag") || undefined,
				month: url.searchParams.get("month") || undefined,
				includeUnpublished: isAdmin || mine,
				authorId: mine ? authorId : undefined,
			});
			if (!isAdmin && !mine) result.posts = result.posts.map(redactPostSecrets);
			return json(result, 200, isAdmin || mine ? "private" : "list");
		}

		if (segments[0] === "search") {
			const q = url.searchParams.get("q") || "";
			const rawLimit = Number(url.searchParams.get("limit") || 20);
			const limit = Number.isFinite(rawLimit)
				? Math.min(50, Math.max(1, Math.floor(rawLimit)))
				: 20;
			const posts = await searchPosts(cfEnv, q, limit);
			return json({ posts: isAdmin ? posts : posts.map(redactPostSecrets) });
		}

		if (segments[0] === "neighbors" && segments[1]) {
			if (!isValidPostSlug(decodePostSlug(segments[1])))
				return badRequest("文章 slug 格式无效");
			const neighbors = await getPostNeighbors(cfEnv, segments[1]);
			if (!isAdmin) {
				neighbors.prev = neighbors.prev
					? redactPostSecrets(neighbors.prev)
					: null;
				neighbors.next = neighbors.next
					? redactPostSecrets(neighbors.next)
					: null;
			}
			return json(neighbors, 200, "list");
		}

		const slug = segments[0];
		if (!slug) return notFound();

		if (!isValidPostSlug(decodePostSlug(slug)))
			return badRequest("文章 slug 格式无效");

		// 作者访问单篇：自己的（含草稿）给完整视图+源文；他人的退回公开视图（草稿 404）
		let ownDraft = isAdmin;
		if (isAuthor) {
			const owner = await getPostOwner(cfEnv, slug);
			ownDraft = owner?.author_id === authorId;
		}

		const post = await getPostBySlug(cfEnv, slug, {
			includeUnpublished: ownDraft,
			includeSource: ownDraft,
		});
		if (!post) return notFound("文章不存在");
		return json(
			ownDraft ? post : redactPostSecrets(post),
			200,
			ownDraft ? "private" : "default",
		);
	} catch (error) {
		return fromServiceError(error);
	}
};

export const PUT: APIRoute = async ({ params, request }) => {
	const segments = pathSegments(params);
	const slug = segments[0];
	if (!slug || !isValidPostSlug(decodePostSlug(slug)))
		return badRequest("文章 slug 格式无效");

	const actor = await resolveBackendActor(request, cfEnv);
	if (!actor || !actor.ability.can("update", "Post")) return unauthorized();

	// 归属校验先于限流：越权请求不消耗写配额
	const owner = await getPostOwner(cfEnv, slug);
	if (owner && !actor.isAdmin && owner.author_id !== actor.user?.id)
		return json({ error: "只能操作自己发布的文章" }, 403, "private");
	if (!owner && !actor.ability.can("create", "Post")) return unauthorized();

	// 写入操作限流：每分钟最多 10 次（D1 持久化，跨边缘节点一致）
	return withRateLimit(
		cfEnv,
		request,
		{
			windowMs: 60_000,
			maxRequests: 10,
			scope: "posts-write",
			failOpen: false,
		},
		async () => {
			try {
				const body = await request.text();
				if (!body.trim()) return badRequest("正文不能为空");
				// 新建时记录归属；已有文章更新不传（DO UPDATE 不改 author_id）
				const authorId = owner ? undefined : (actor.user?.id ?? null);
				const result = await upsertPost(cfEnv, slug, body, authorId);
				return json({ ok: true, ...result });
			} catch (error) {
				return fromServiceError(error);
			}
		},
	);
};

export const DELETE: APIRoute = async ({ params, request }) => {
	const segments = pathSegments(params);
	const slug = segments[0];
	if (!slug || !isValidPostSlug(decodePostSlug(slug)))
		return badRequest("文章 slug 格式无效");

	const actor = await resolveBackendActor(request, cfEnv);
	if (!actor || !actor.ability.can("delete", "Post")) return unauthorized();

	const owner = await getPostOwner(cfEnv, slug);
	if (owner && !actor.isAdmin && owner.author_id !== actor.user?.id)
		return json({ error: "只能操作自己发布的文章" }, 403, "private");

	return withRateLimit(
		cfEnv,
		request,
		{ windowMs: 60_000, maxRequests: 5, scope: "posts-write", failOpen: false },
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

export const ALL: APIRoute = async () =>
	methodNotAllowed(["DELETE", "GET", "PUT"]);
