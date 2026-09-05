<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

type PostItem = {
	slug: string;
	title: string;
	date: string;
	cover?: string;
	published: number;
	pin_order?: number;
	password?: string;
};

let posts: PostItem[] = [];
let loading = true;
let error = "";
let search = "";
let status = "all"; // all | published | draft
let selected = new Set<string>();
let deleting = false;

async function load() {
	loading = true;
	error = "";
	try {
		const data = await apiJson<{ posts?: PostItem[] }>("/api/posts/?pageSize=200");
		posts = data.posts || [];
	} catch {
		error = "加载失败";
	}
	loading = false;
}

async function remove(slug: string) {
	if (!confirm(`确定删除文章「${slug}」？此操作不可恢复。`)) return;
	const ok = await doDelete(slug);
	if (ok) posts = posts.filter((p) => p.slug !== slug);
}

async function doDelete(slug: string): Promise<boolean> {
	try {
		await apiJson(`/api/posts/${encodeURIComponent(slug)}/`, {
			method: "DELETE",
		});
		return true;
	} catch (e) {
		alert(e instanceof Error ? e.message : "删除失败");
		return false;
	}
}

async function batchDelete() {
	const list = [...selected];
	if (list.length === 0) return;
	if (!confirm(`确定删除选中的 ${list.length} 篇文章？此操作不可恢复。`)) return;
	deleting = true;
	for (const slug of list) {
		if (await doDelete(slug)) {
			posts = posts.filter((p) => p.slug !== slug);
		}
	}
	selected = new Set();
	deleting = false;
}

function toggle(slug: string) {
	if (selected.has(slug)) selected.delete(slug);
	else selected.add(slug);
	selected = new Set(selected);
}

function toggleAll() {
	selected =
		filtered.length > 0 && selected.size === filtered.length
			? new Set()
			: new Set(filtered.map((p) => p.slug));
	selected = new Set(selected);
}

function handleCoverError(e: Event) {
	const img = e.currentTarget as HTMLImageElement;
	img.style.visibility = "hidden";
}

onMount(load);

$: filtered = posts.filter((p) => {
	const hitSearch =
		!search ||
		p.title.toLowerCase().includes(search.toLowerCase()) ||
		p.slug.toLowerCase().includes(search.toLowerCase());
	const hitStatus =
		status === "all" || (status === "published" ? p.published === 1 : p.published === 0);
	return hitSearch && hitStatus;
});
$: publishedCount = posts.filter((p) => p.published === 1).length;
$: draftCount = posts.length - publishedCount;
</script>

<div class="pl-page">
	<div class="dash-card pl-toolbar">
		<div class="pl-toolbar-top">
			<div>
				<h2>文章管理</h2>
				<p class="pl-sub">
					共 {posts.length} 篇 · 已发布 {publishedCount} · 草稿 {draftCount}{#if selected.size > 0}
						· 已选 {selected.size}{/if}
				</p>
			</div>
			<div class="pl-toolbar-actions">
				<label class="pl-selectall">
					<input
						type="checkbox"
						checked={filtered.length > 0 && selected.size === filtered.length}
						on:change={toggleAll}
					/>
					全选
				</label>
				<a class="btn-primary" href="/admin/posts/new/">+ 新建文章</a>
			</div>
		</div>
		<div class="pl-filters">
			<div class="chips">
				<button class="chip" class:active={status === "all"} on:click={() => (status = "all")}>全部</button>
				<button class="chip" class:active={status === "published"} on:click={() => (status = "published")}>已发布</button>
				<button class="chip" class:active={status === "draft"} on:click={() => (status = "draft")}>草稿</button>
			</div>
			<input type="search" placeholder="搜索标题 / slug…" bind:value={search} />
			{#if selected.size > 0}
				<button class="btn-danger" on:click={batchDelete} disabled={deleting}>
					{deleting ? "删除中…" : `删除选中 (${selected.size})`}
				</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="dash-card pl-empty">加载中…</div>
	{:else if error}
		<div class="dash-card pl-empty error">{error}</div>
	{:else if filtered.length === 0}
		<div class="dash-card pl-empty">暂无文章</div>
	{:else}
		<div class="pl-grid">
			{#each filtered as post (post.slug)}
				<div class="pl-card" class:selected={selected.has(post.slug)}>
					<label class="pl-card-check">
						<input
							type="checkbox"
							checked={selected.has(post.slug)}
							on:change={() => toggle(post.slug)}
						/>
					</label>
					<a class="pl-card-cover" href={`/admin/posts/edit/${encodeURIComponent(post.slug)}/`}>
						<div class="pl-card-cover-empty">无封面</div>
						{#if post.cover}
							<img
								src={post.cover}
								alt={post.title}
								loading="lazy"
								referrerpolicy="no-referrer"
								on:error={handleCoverError}
							/>
						{/if}
					</a>
					<div class="pl-card-body">
						<div class="pl-card-title-row">
							<span class="pl-card-title">{post.title}</span>
							{#if post.pin_order}<span class="badge amber">置顶</span>{/if}
							{#if post.password}<span class="badge slate">加密</span>{/if}
						</div>
						<div class="pl-card-meta">
							<span class="mono">{post.slug}</span>
							<span class="pl-card-date">{post.date}</span>
						</div>
						<div class="pl-card-status">
							{#if post.published === 1}
								<span class="badge published">已发布</span>
							{:else}
								<span class="badge draft">草稿</span>
							{/if}
						</div>
					</div>
					<div class="pl-card-ops">
						<a class="op-link" href={`/admin/posts/edit/${encodeURIComponent(post.slug)}/`}>编辑</a>
						<button class="op-del" on:click={() => remove(post.slug)}>删除</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pl-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 1280px;
		margin: 0 auto;
	}
	.dash-card {
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		border-radius: 0.9rem;
		padding: 1.1rem 1.15rem;
	}
	.pl-toolbar {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	.pl-toolbar-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.pl-toolbar-actions {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.pl-selectall {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.82rem;
		color: var(--text-muted);
		cursor: pointer;
	}
	.pl-selectall input {
		accent-color: var(--primary);
	}
	.pl-toolbar h2 {
		margin: 0;
		font-size: 1.12rem;
		font-weight: 700;
		color: var(--deep-text);
	}
	.pl-sub {
		margin: 0.2rem 0 0;
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.pl-filters {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.chips {
		display: inline-flex;
		gap: 0.3rem;
	}
	.chip {
		padding: 0.3rem 0.75rem;
		border: 1px solid var(--line-divider);
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
	}
	.chip.active {
		background: color-mix(in oklch, var(--primary) 12%, transparent);
		border-color: transparent;
		color: var(--primary);
		font-weight: 600;
	}
	.pl-filters input {
		flex: 1;
		min-width: 180px;
		padding: 0.42rem 0.7rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--deep-text);
		font-size: 0.86rem;
	}

	.pl-empty {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
	.pl-empty.error {
		color: var(--danger);
	}

	.pl-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}
	.pl-card {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		border-radius: 0.9rem;
		overflow: hidden;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}
	.pl-card.selected {
		border-color: var(--primary);
		box-shadow: 0 0 0 1px var(--primary);
	}
	.pl-card-check {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 2;
		display: inline-flex;
		padding: 0.25rem 0.35rem;
		border-radius: 0.45rem;
		background: color-mix(in oklch, #000 35%, transparent);
		cursor: pointer;
	}
	.pl-card-check input {
		accent-color: var(--primary);
		width: 1rem;
		height: 1rem;
	}
	.pl-card-cover {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		background: var(--btn-regular-bg);
		overflow: hidden;
	}
	.pl-card-cover img {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.pl-card-cover-empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	.pl-card-body {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.8rem 0.9rem 0.5rem;
		flex: 1;
	}
	.pl-card-title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.pl-card-title {
		font-weight: 600;
		color: var(--deep-text);
		font-size: 0.95rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pl-card-meta {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.76rem;
		color: var(--text-muted);
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.74rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pl-card-status {
		display: flex;
		gap: 0.4rem;
	}
	.badge {
		display: inline-block;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 600;
		vertical-align: middle;
	}
	.badge.amber {
		background: color-mix(in oklch, #f59e0b 16%, transparent);
		color: #b45309;
	}
	.badge.slate {
		background: var(--btn-regular-bg);
		color: var(--text-muted);
	}
	.badge.published {
		background: color-mix(in oklch, #10b981 16%, transparent);
		color: #059669;
	}
	.badge.draft {
		background: var(--btn-regular-bg);
		color: var(--text-muted);
	}
	.pl-card-ops {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.6rem 0.9rem;
		border-top: 1px solid var(--line-divider);
	}
	.op-link {
		color: var(--primary);
		text-decoration: none;
		font-size: 0.86rem;
	}
	.op-del {
		background: none;
		border: none;
		color: var(--danger);
		cursor: pointer;
		font-size: 0.86rem;
		padding: 0;
	}

	@media (max-width: 767px) {
		.pl-grid {
			grid-template-columns: 1fr;
		}
		.pl-toolbar-top {
			align-items: flex-start;
		}
	}
</style>
