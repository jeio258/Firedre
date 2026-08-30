import type { CloudflareEnv } from "../../types/env";
import type {
	ArchiveMonthItem,
	CategoryTreeNode,
	PostFrontmatter,
	PostListItem,
	TagCountItem,
} from "../../types/posts";
import { categoryPathFromFrontmatter, normalizeTags } from "./frontmatter";

export type { ArchiveMonthItem, CategoryTreeNode, TagCountItem };

interface CategoryNodeInternal {
	count: number;
	children: Map<string, CategoryNodeInternal>;
}

function ensureNode(map: Map<string, CategoryNodeInternal>, name: string) {
	const existing = map.get(name);
	if (existing) return existing;
	const node: CategoryNodeInternal = { count: 0, children: new Map() };
	map.set(name, node);
	return node;
}

export function buildCategoryTreeFromPaths(paths: string[]) {
	const root = new Map<string, CategoryNodeInternal>();

	for (const rawPath of paths) {
		const parts =
			rawPath === "Uncategorized"
				? ["Uncategorized"]
				: rawPath.split("/").filter(Boolean);

		let currentMap = root;
		for (const part of parts) {
			const node = ensureNode(currentMap, part);
			node.count += 1;
			currentMap = node.children;
		}
	}

	return root;
}

export function buildCategoryTreeFromPosts(posts: PostListItem[]) {
	const paths = posts.map((post) => {
		if (!post.categories) return "Uncategorized";
		if (typeof post.categories === "string") return post.categories;
		return post.categories.join("/");
	});
	return buildCategoryTreeFromPaths(paths);
}

function nodeToTree(
	map: Map<string, CategoryNodeInternal>,
): CategoryTreeNode[] {
	return [...map.entries()]
		.sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
		.map(([name, node]) => ({
			name,
			total: node.count,
			children: nodeToTree(node.children),
		}));
}

export function serializeCategoryTree(
	map: Map<string, CategoryNodeInternal>,
): CategoryTreeNode[] {
	return nodeToTree(map);
}

export function buildTagCountsFromPosts(posts: PostListItem[]): TagCountItem[] {
	const tags = new Map<string, number>();
	for (const post of posts) {
		for (const tag of post.tags || []) {
			tags.set(tag, (tags.get(tag) || 0) + 1);
		}
	}
	return [...tags.entries()]
		.sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
		.map(([name, count]) => ({ name, count }));
}

export function buildArchiveMonthsFromPosts(
	posts: PostListItem[],
): ArchiveMonthItem[] {
	const months = new Map<string, number>();
	for (const post of posts) {
		if (!post.date) continue;
		const month = post.date.slice(0, 7);
		if (!/^\d{4}-\d{2}$/.test(month)) continue;
		months.set(month, (months.get(month) || 0) + 1);
	}
	return [...months.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([month, count]) => ({ month, count }));
}

export async function syncPostTaxonomy(
	env: CloudflareEnv,
	slug: string,
	frontmatter: PostFrontmatter,
) {
	// 与 upsertPost 保持一致：优先 categories，回退到单数 category 字段
	const resolvedCategories =
		(frontmatter.categories?.length ?? 0) > 0
			? frontmatter.categories
			: frontmatter.category
				? [String(frontmatter.category)]
				: undefined;
	const categoryPath = categoryPathFromFrontmatter(resolvedCategories);
	const tags = normalizeTags(frontmatter.tags) || [];

	await env.DB.prepare("DELETE FROM post_categories WHERE post_slug = ?")
		.bind(slug)
		.run();
	await env.DB.prepare("DELETE FROM post_tags WHERE post_slug = ?")
		.bind(slug)
		.run();

	await env.DB.prepare(
		"INSERT INTO post_categories (post_slug, category_path) VALUES (?, ?)",
	)
		.bind(slug, categoryPath)
		.run();

	for (const tag of tags) {
		await env.DB.prepare("INSERT INTO post_tags (post_slug, tag) VALUES (?, ?)")
			.bind(slug, tag)
			.run();
	}
}

export async function listCategoryTree(
	env: CloudflareEnv,
): Promise<CategoryTreeNode[]> {
	const { results } = await env.DB.prepare(`
    SELECT pc.category_path
    FROM post_categories pc
    INNER JOIN posts p ON p.slug = pc.post_slug
    WHERE p.published = 1
  `).all<{ category_path: string }>();

	const paths = (results || []).map((row) => row.category_path);
	return serializeCategoryTree(buildCategoryTreeFromPaths(paths));
}

export async function listTagCounts(
	env: CloudflareEnv,
): Promise<TagCountItem[]> {
	const { results } = await env.DB.prepare(`
    SELECT pt.tag AS name, COUNT(*) AS count
    FROM post_tags pt
    INNER JOIN posts p ON p.slug = pt.post_slug
    WHERE p.published = 1
    GROUP BY pt.tag
    ORDER BY count DESC, name ASC
  `).all<TagCountItem>();

	return results || [];
}

export async function listArchiveMonths(
	env: CloudflareEnv,
): Promise<ArchiveMonthItem[]> {
	const { results } = await env.DB.prepare(`
    SELECT substr(date, 1, 7) AS month, COUNT(*) AS count
    FROM posts
    WHERE published = 1 AND date IS NOT NULL AND length(date) >= 7
    GROUP BY month
    ORDER BY month DESC
  `).all<ArchiveMonthItem>();

	return results || [];
}

export function categoryFilterSql(category: string) {
	return {
		join: "INNER JOIN post_categories pc ON pc.post_slug = p.slug",
		where:
			category === "Uncategorized"
				? "pc.category_path = ?"
				: "(pc.category_path = ? OR pc.category_path LIKE ?)",
		binds:
			category === "Uncategorized"
				? (["Uncategorized"] as unknown[])
				: ([category, `${category}/%`] as unknown[]),
	};
}

export function tagFilterSql(tag: string) {
	return {
		join: "INNER JOIN post_tags pt ON pt.post_slug = p.slug",
		where: "pt.tag = ?",
		binds: [tag] as unknown[],
	};
}

export function monthFilterSql(month: string) {
	return {
		join: "",
		where: "substr(p.date, 1, 7) = ?",
		binds: [month] as unknown[],
	};
}
