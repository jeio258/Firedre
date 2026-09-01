import type { CloudflareEnv } from "../../types/env";
import type {
	ArchiveMonthItem,
	CategoryTreeNode,
	PostFrontmatter,
	TagCountItem,
} from "../../types/posts";
import { categoryPathFromFrontmatter, normalizeTags, resolveCategories } from "./frontmatter";

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

export async function syncPostTaxonomy(
	env: CloudflareEnv,
	slug: string,
	frontmatter: PostFrontmatter,
) {

	const resolvedCategories = resolveCategories(frontmatter);
	const categoryPath = categoryPathFromFrontmatter(resolvedCategories);
	const tags = normalizeTags(frontmatter.tags) || [];

	await env.DB.prepare("DELETE FROM post_taxonomy WHERE post_slug = ?")
		.bind(slug)
		.run();

	await env.DB.prepare(
		"INSERT INTO post_taxonomy (post_slug, type, value) VALUES (?, 'category', ?)",
	)
		.bind(slug, categoryPath)
		.run();

	for (const tag of tags) {
		await env.DB.prepare(
			"INSERT INTO post_taxonomy (post_slug, type, value) VALUES (?, 'tag', ?)",
		)
			.bind(slug, tag)
			.run();
	}
}

export async function listCategoryTree(
	env: CloudflareEnv,
): Promise<CategoryTreeNode[]> {
	const { results } = await env.DB.prepare(`
    SELECT pt.value AS category_path
    FROM post_taxonomy pt
    INNER JOIN posts p ON p.slug = pt.post_slug
    WHERE pt.type = 'category' AND p.published = 1
  `).all<{ category_path: string }>();

	const paths = (results || []).map((row) => row.category_path);
	return serializeCategoryTree(buildCategoryTreeFromPaths(paths));
}

export async function listTagCounts(
	env: CloudflareEnv,
): Promise<TagCountItem[]> {
	const { results } = await env.DB.prepare(`
    SELECT pt.value AS name, COUNT(*) AS count
    FROM post_taxonomy pt
    INNER JOIN posts p ON p.slug = pt.post_slug
    WHERE pt.type = 'tag' AND p.published = 1
    GROUP BY pt.value
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
		join: "INNER JOIN post_taxonomy pt_c ON pt_c.post_slug = p.slug AND pt_c.type = 'category'",
		where:
			category === "Uncategorized"
				? "pt_c.value = ?"
				: "(pt_c.value = ? OR pt_c.value LIKE ?)",
		binds:
			category === "Uncategorized"
				? (["Uncategorized"] as unknown[])
				: ([category, `${category}/%`] as unknown[]),
	};
}

export function tagFilterSql(tag: string) {
	return {
		join: "INNER JOIN post_taxonomy pt_t ON pt_t.post_slug = p.slug AND pt_t.type = 'tag'",
		where: "pt_t.value = ?",
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
