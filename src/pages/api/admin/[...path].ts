import type { CloudflareEnv } from "../../../../types/env";
import type { APIRoute } from "astro";
import {
	ADMIN_SESSION_COOKIE,
	buildClearSessionCookie,
	buildSessionCookie,
	createSessionToken,
	getCookieValue,
	getSessionUser,
	resolveAdminEnv,
	verifyAdminRequest,
} from "../../../../server/auth/adminSession";
import {
	authenticateAdmin,
	createAdminUser,
	hasAdminUser,
	updateAdminUserPassword,
} from "../../../../server/auth/adminUser";
import {
	createD1LoginRateLimit,
	formatLoginRateLimitMessage,
	getRequestClientIp,
} from "../../../../server/auth/loginRateLimit";
import {
	cfEnv,
	json,
	methodNotAllowed,
	serverError,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

function jsonWithHeaders(
	data: unknown,
	status = 200,
	extraHeaders: Record<string, string> = {},
) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
			...extraHeaders,
		},
	});
}

export const POST: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const action = segments[0] || "";
	const adminEnv = resolveAdminEnv(cfEnv);
	const secure = new URL(request.url).protocol === "https:";

	try {
		// 首次创建唯一管理员（注册）：仅当系统尚无管理员时允许。
		if (action === "setup") {
			const body = (await request.json()) as {
				username?: string;
				password?: string;
			};
			const username = String(body.username || "").trim();
			const password = String(body.password || "");

			if (!username || !password)
				return json({ message: "用户名与密码不能为空" }, 400);
			if (password.length < 8)
				return json({ message: "密码至少 8 位" }, 400);

			if (await hasAdminUser(cfEnv.DB))
				return json({ message: "管理员已存在，无法重复创建" }, 409);

			const result = await createAdminUser(cfEnv.DB, username, password);
			if (!result.ok)
				return json({ message: "创建失败或用户名已存在" }, 400);

			// 创建成功后直接登录
			const token = await createSessionToken(username, adminEnv);
			return jsonWithHeaders({ ok: true, username }, 200, {
				"Set-Cookie": buildSessionCookie(token, secure),
			});
		}

		if (action === "login") {
			const body = (await request.json()) as {
				username?: string;
				password?: string;
			};
			const username = String(body.username || "").trim();
			const password = String(body.password || "");
			const clientIp = getRequestClientIp(request);
			const rateLimit = createD1LoginRateLimit(cfEnv.DB);

			const limit = await rateLimit.check(clientIp);
			if (!limit.allowed) {
				return json(
					{ message: formatLoginRateLimitMessage(limit.retryAfterSec || 60) },
					429,
				);
			}

			// 使用 D1 唯一管理员验证（不再依赖 Secrets）
			const isValid = await authenticateAdmin(
				cfEnv,
				cfEnv.DB,
				username,
				password,
			);
			if (!isValid) {
				await rateLimit.recordFailure(clientIp);
				return json({ message: "账号或密码错误" }, 401);
			}

			await rateLimit.clear(clientIp);
			const token = await createSessionToken(username, adminEnv);
			return jsonWithHeaders({ ok: true, username }, 200, {
				"Set-Cookie": buildSessionCookie(token, secure),
			});
		}

		if (action === "logout") {
			return jsonWithHeaders({ ok: true }, 200, {
				"Set-Cookie": buildClearSessionCookie(secure),
			});
		}

		if (action === "users") {
			const isAdmin = await verifyAdminRequest(request, cfEnv);
			if (!isAdmin) return unauthorized();

			const sub = segments[1] || "";
			if (sub !== "password") return json({ message: "未知操作" }, 400);

			const body = (await request.json().catch(() => ({}))) as {
				username?: string;
				password?: string;
			};
			const target = String(body.username || "").trim();
			if (!target || !body.password)
				return json({ message: "用户名与密码不能为空" }, 400);

			const ok = await updateAdminUserPassword(
				cfEnv.DB,
				target,
				body.password,
			);
			if (!ok) return json({ message: "用户不存在" }, 404);
			return jsonWithHeaders({ ok: true });
		}

		return json({ message: "Not found" }, 404);
	} catch (error) {
		return serverError(error);
	}
};

export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const action = segments[0] || "";

	// 初始化状态：公开查询，供登录页/初始化页判断是否需创建管理员
	if (action === "setup-status") {
		return jsonWithHeaders({ setup: !(await hasAdminUser(cfEnv.DB)) });
	}

	if (action !== "me" && action !== "stats")
		return json({ message: "Not found" }, 404);

	try {
		const adminEnv = resolveAdminEnv(cfEnv);

		const isAdmin = await verifyAdminRequest(request, cfEnv);
		if (!isAdmin) return json({ authenticated: false }, 200, "private");

		if (action === "me") {
			const token = getCookieValue(
				request.headers.get("Cookie"),
				ADMIN_SESSION_COOKIE,
			);
			const username = token ? await getSessionUser(token, adminEnv) : null;
			return json(
				{ authenticated: true, username: username || "" },
				200,
				"private",
			);
		}

		// action === "stats"：后台仪表盘聚合
		const stats = await collectAdminStats(cfEnv.DB);
		return jsonWithHeaders(stats);
	} catch (error) {
		if (action === "stats") return serverError(error);
		return json({ authenticated: false }, 200, "private");
	}
};

// ── 后台仪表盘聚合统计 ──
async function collectAdminStats(db: CloudflareEnv["DB"]) {
	const monthLabel = (d: Date) =>
		`${String(d.getUTCFullYear()).slice(2)}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
	const months = new Map<string, { label: string; 发布: number; 草稿: number }>();
	for (let i = 11; i >= 0; i--) {
		const d = new Date(Date.now() - i * 30 * 86400_000);
		const key = monthLabel(d);
		months.set(key, { label: key, 发布: 0, 草稿: 0 });
	}

	const [postRows, trendRows, catRows, topRows, recentRows, dynCount, frCount, albCount] =
		await Promise.all([
			db.prepare("SELECT published, COUNT(*) AS c FROM posts GROUP BY published").all<{ published: number; c: number }>(),
			db.prepare("SELECT date, published FROM posts").all<{ date: string; published: number }>(),
			db.prepare(`
        SELECT pt.value AS v, COUNT(*) AS c
        FROM post_taxonomy pt
        JOIN posts p ON p.slug = pt.post_slug
        WHERE pt.type = 'category' AND p.published = 1
        GROUP BY pt.value
      `).all<{ v: string; c: number }>(),
			db.prepare(
				"SELECT slug, title, words, minutes FROM posts WHERE published = 1 ORDER BY words DESC LIMIT 6",
			).all<{ slug: string; title: string; words: number; minutes: number }>(),
			db.prepare(
				"SELECT slug, title, categories, tags, published, pin_order, updated, date FROM posts ORDER BY COALESCE(NULLIF(updated, ''), date) DESC, date DESC LIMIT 6",
			).all<{ slug: string; title: string; categories: string | null; tags: string | null; published: number; pin_order: number; updated: string | null; date: string }>(),
			db.prepare("SELECT COUNT(*) AS c FROM dynamics").first<{ c: number }>(),
			db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(enabled), 0) AS e FROM friends").first<{ c: number; e: number }>(),
			db.prepare("SELECT COUNT(*) AS c FROM albums").first<{ c: number }>(),
		]);

	const list = (s: string | null): string[] => {
		try {
			const v = s ? JSON.parse(s) : null;
			return Array.isArray(v) ? v.map(String) : [];
		} catch {
			return [];
		}
	};

	let published = 0;
	let draft = 0;
	let words = 0;
	for (const r of postRows.results || []) {
		if (r.published === 1) published += r.c;
		else draft += r.c;
	}
	for (const r of topRows.results || []) words += r.words || 0;

	for (const r of trendRows.results || []) {
		if (!r.date) continue;
		const d = new Date(r.date);
		if (Number.isNaN(d.getTime())) continue;
		const key = monthLabel(d);
		const slot = months.get(key);
		if (!slot) continue;
		if (r.published === 1) slot.发布 += 1;
		else slot.草稿 += 1;
	}

	const catMap = new Map<string, number>();
	for (const r of catRows.results || []) {
		const top = String(r.v || "未分类").split("/")[0].trim() || "未分类";
		catMap.set(top, (catMap.get(top) ?? 0) + r.c);
	}
	const categoryDist = [...catMap.entries()]
		.map(([name, count]) => ({ name, 文章数: count }))
		.sort((a, b) => b.文章数 - a.文章数);

	const [basicRow, tagRow] = await Promise.all([
		db.prepare("SELECT value FROM site_settings WHERE key = 'basic'").first<{ value: string }>(),
		db.prepare("SELECT COUNT(*) AS c FROM post_taxonomy WHERE type = 'tag'").first<{ c: number }>(),
	]);
	let siteTitle = "Firedre";
	try {
		const v = basicRow?.value ? JSON.parse(basicRow.value) : null;
		if (v && typeof v.title === "string" && v.title.trim()) siteTitle = v.title.trim();
	} catch {
		// 忽略
	}

	return {
		siteTitle,
		totals: {
			posts: published + draft,
			published,
			draft,
			words,
			dynamics: dynCount?.c ?? 0,
			friends: frCount?.c ?? 0,
			friendsEnabled: frCount?.e ?? 0,
			tags: tagRow?.c ?? 0,
			categories: catMap.size,
			albums: albCount?.c ?? 0,
		},
		monthlyTrend: [...months.values()],
		statusDist: [
			{ name: "已发布", value: published },
			{ name: "草稿", value: draft },
		].filter((x) => x.value > 0),
		categoryDist,
		topWords: ((topRows.results || []) as { slug: string; title: string; words: number; minutes: number }[]).map(
			(r) => ({
				slug: r.slug,
				title: r.title,
				words: r.words ?? 0,
				minutes: r.minutes ?? 0,
			}),
		),
		recent: ((recentRows.results || []) as {
			slug: string;
			title: string;
			categories: string | null;
			tags: string | null;
			published: number;
			pin_order: number;
			updated: string | null;
			date: string;
		}[]).map((r) => ({
			slug: r.slug,
			title: r.title,
			categories: list(r.categories),
			tags: list(r.tags),
			published: r.published === 1,
			pinned: (r.pin_order ?? 0) > 0,
			updated: r.updated || r.date,
		})),
	};
}

export const ALL: APIRoute = async () => methodNotAllowed();
