import type { CloudflareEnv } from "../../types/env";
import { parseStringListOrEmpty } from "../utils/json";

// ── 后台仪表盘聚合统计 ──
export async function collectAdminStats(db: CloudflareEnv["DB"]) {
	const monthLabel = (d: Date) =>
		`${String(d.getUTCFullYear()).slice(2)}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
	const months = new Map<
		string,
		{ label: string; 发布: number; 草稿: number }
	>();
	for (let i = 11; i >= 0; i--) {
		const d = new Date(Date.now() - i * 30 * 86400_000);
		const key = monthLabel(d);
		months.set(key, { label: key, 发布: 0, 草稿: 0 });
	}

	const [
		postRows,
		trendRows,
		catRows,
		topRows,
		recentRows,
		dynCount,
		frCount,
		albCount,
	] = await Promise.all([
		db
			.prepare("SELECT published, COUNT(*) AS c FROM posts GROUP BY published")
			.all<{ published: number; c: number }>(),
		db
			.prepare("SELECT date, published FROM posts")
			.all<{ date: string; published: number }>(),
		db
			.prepare(`
        SELECT pt.value AS v, COUNT(*) AS c
        FROM post_taxonomy pt
        JOIN posts p ON p.slug = pt.post_slug
        WHERE pt.type = 'category' AND p.published = 1
        GROUP BY pt.value
      `)
			.all<{ v: string; c: number }>(),
		db
			.prepare(
				"SELECT slug, title, words, minutes FROM posts WHERE published = 1 ORDER BY words DESC LIMIT 6",
			)
			.all<{ slug: string; title: string; words: number; minutes: number }>(),
		db
			.prepare(
				"SELECT slug, title, categories, tags, published, pin_order, updated, date FROM posts ORDER BY COALESCE(NULLIF(updated, ''), date) DESC, date DESC LIMIT 6",
			)
			.all<{
				slug: string;
				title: string;
				categories: string | null;
				tags: string | null;
				published: number;
				pin_order: number;
				updated: string | null;
				date: string;
			}>(),
		db.prepare("SELECT COUNT(*) AS c FROM dynamics").first<{ c: number }>(),
		db
			.prepare(
				"SELECT COUNT(*) AS c, COALESCE(SUM(enabled), 0) AS e FROM friends",
			)
			.first<{ c: number; e: number }>(),
		db.prepare("SELECT COUNT(*) AS c FROM albums").first<{ c: number }>(),
	]);

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
		const top =
			String(r.v || "未分类")
				.split("/")[0]
				.trim() || "未分类";
		catMap.set(top, (catMap.get(top) ?? 0) + r.c);
	}
	const categoryDist = [...catMap.entries()]
		.map(([name, count]) => ({ name, 文章数: count }))
		.sort((a, b) => b.文章数 - a.文章数);

	const [basicRow, tagRow] = await Promise.all([
		db
			.prepare("SELECT value FROM site_settings WHERE key = 'basic'")
			.first<{ value: string }>(),
		db
			.prepare("SELECT COUNT(*) AS c FROM post_taxonomy WHERE type = 'tag'")
			.first<{ c: number }>(),
	]);
	let siteTitle = "Firedre";
	try {
		const v = basicRow?.value ? JSON.parse(basicRow.value) : null;
		if (v && typeof v.title === "string" && v.title.trim())
			siteTitle = v.title.trim();
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
		topWords: (
			(topRows.results || []) as {
				slug: string;
				title: string;
				words: number;
				minutes: number;
			}[]
		).map((r) => ({
			slug: r.slug,
			title: r.title,
			words: r.words ?? 0,
			minutes: r.minutes ?? 0,
		})),
		recent: (
			(recentRows.results || []) as {
				slug: string;
				title: string;
				categories: string | null;
				tags: string | null;
				published: number;
				pin_order: number;
				updated: string | null;
				date: string;
			}[]
		).map((r) => ({
			slug: r.slug,
			title: r.title,
			categories: parseStringListOrEmpty(r.categories),
			tags: parseStringListOrEmpty(r.tags),
			published: r.published === 1,
			pinned: (r.pin_order ?? 0) > 0,
			updated: r.updated || r.date,
		})),
	};
}
