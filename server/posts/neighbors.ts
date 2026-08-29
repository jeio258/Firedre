import type { PostListItem } from "../../types/posts";

export function getLocalPostNeighbors(
	posts: PostListItem[],
	slug: string,
): { prev: PostListItem | null; next: PostListItem | null } {
	const index = posts.findIndex((post) => post.slug === slug);
	if (index === -1) return { prev: null, next: null };

	return {
		prev: index > 0 ? posts[index - 1] : null,
		next: index < posts.length - 1 ? posts[index + 1] : null,
	};
}
