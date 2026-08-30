<script lang="ts">
import { onMount } from "svelte";

let stats = {
	posts: "-",
	dynamics: "-",
	links: "-",
	tags: "-",
	categories: "-",
};
let loading = true;

onMount(async () => {
	try {
		const [posts, dynamics, friends, tags, categories] = await Promise.all([
			fetch("/api/posts/?pageSize=1").then((r) => r.json()),
			fetch("/api/dynamics/").then((r) => r.json()),
			fetch("/api/friends/").then((r) => r.json()),
			fetch("/api/posts/taxonomy/tags/").then((r) => r.json()),
			fetch("/api/posts/taxonomy/categories/").then((r) => r.json()),
		]);
		stats = {
			posts: String(posts.total ?? 0),
			dynamics: String(dynamics.total ?? 0),
			links: String((friends.items || []).length),
			tags: String((tags.tags || []).length),
			categories: String((categories.categories || []).length),
		};
	} catch {
		// 忽略统计失败
	}
	loading = false;
});
</script>

<div class="admin-card">
	<h2>仪表盘</h2>
	{#if loading}
		<p class="hint">加载中…</p>
	{:else}
		<div class="stats">
			<div class="stat">
				<div class="num">{stats.posts}</div>
				<div class="label">文章</div>
			</div>
			<div class="stat">
				<div class="num">{stats.dynamics}</div>
				<div class="label">动态</div>
			</div>
			<div class="stat">
				<div class="num">{stats.links}</div>
				<div class="label">友链</div>
			</div>
			<div class="stat">
				<div class="num">{stats.tags}</div>
				<div class="label">标签</div>
			</div>
			<div class="stat">
				<div class="num">{stats.categories}</div>
				<div class="label">分类</div>
			</div>
		</div>
		<div class="links">
			<a href="/admin/posts/">管理文章</a>
			<a href="/admin/posts/new/">写新文章</a>
			<a href="/admin/links/">友链</a>
			<a href="/admin/gallery/">相册</a>
		</div>
	{/if}
</div>

<style>
	.admin-card {
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: var(--radius-large, 0.75rem);
		padding: 1.5rem;
	}
	h2 {
		font-size: 1.15rem;
		margin: 0 0 1.25rem;
		color: var(--deep-text, inherit);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.stat {
		background: var(--btn-regular-bg, #f9fafb);
		border-radius: 0.6rem;
		padding: 1.25rem;
		text-align: center;
	}
	.num {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--primary, #5b8cff);
	}
	.label {
		font-size: 0.85rem;
		color: var(--muted, #6b7280);
		margin-top: 0.3rem;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.links a {
		padding: 0.5rem 1rem;
		background: var(--btn-regular-bg, #f9fafb);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.5rem;
		text-decoration: none;
		color: var(--deep-text, #374151);
		font-size: 0.9rem;
	}
	.links a:hover {
		border-color: var(--primary, #5b8cff);
		color: var(--primary, #5b8cff);
	}
	.hint {
		color: var(--muted, #6b7280);
	}
</style>
