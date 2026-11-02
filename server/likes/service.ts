import { UserError } from "../utils/userError";

export interface LikeState {
	count: number;
	liked: boolean;
}

async function assertPublished(db: D1Database, slug: string): Promise<string> {
	const target = String(slug ?? "").trim();
	if (!target) throw new UserError("文章标识不能为空");
	if (target.length > 200) throw new UserError("文章标识不合法");

	const row = await db
		.prepare("SELECT slug FROM posts WHERE slug = ? AND published = 1")
		.bind(target)
		.first<{ slug: string }>();
	if (!row) throw new UserError("文章不存在");
	return row.slug;
}

async function countFor(db: D1Database, slug: string): Promise<number> {
	const row = await db
		.prepare("SELECT COUNT(*) AS n FROM post_likes WHERE post_slug = ?")
		.bind(slug)
		.first<{ n: number }>();
	return Number(row?.n ?? 0);
}

export async function getLikeState(
	db: D1Database,
	slug: string,
	userId: string | null,
): Promise<LikeState> {
	const target = await assertPublished(db, slug);
	const count = await countFor(db, target);
	if (!userId) return { count, liked: false };

	const row = await db
		.prepare(
			"SELECT 1 AS x FROM post_likes WHERE post_slug = ? AND user_id = ?",
		)
		.bind(target, userId)
		.first<{ x: number }>();
	return { count, liked: Boolean(row) };
}

// 切换语义靠 DELETE 的 changes 判定本次是取消还是新增：先删到就返回取消，
// 删不到再 INSERT ... ON CONFLICT DO NOTHING，并发重复提交只会保留一行。
export async function toggleLike(
	db: D1Database,
	slug: string,
	userId: string,
): Promise<LikeState> {
	if (!userId) throw new UserError("请先登录");
	const target = await assertPublished(db, slug);

	const removed = await db
		.prepare("DELETE FROM post_likes WHERE post_slug = ? AND user_id = ?")
		.bind(target, userId)
		.run();

	if (Number(removed.meta?.changes ?? 0) > 0) {
		return { count: await countFor(db, target), liked: false };
	}

	await db
		.prepare(
			`INSERT INTO post_likes (post_slug, user_id, created_at)
			 VALUES (?, ?, datetime('now'))
			 ON CONFLICT(post_slug, user_id) DO NOTHING`,
		)
		.bind(target, userId)
		.run();

	return { count: await countFor(db, target), liked: true };
}
