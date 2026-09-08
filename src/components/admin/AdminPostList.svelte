<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

type PostItem = {
	slug: string;
	title: string;
	date: string;
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

<div class="crud-page">
	<div class="crud-head">
		<div>
			<h2>文章管理</h2>
			<p class="crud-sub">
				共 {posts.length} 篇 · 已发布 {publishedCount} · 草稿 {draftCount}{#if selected.size > 0}
					· 已选 {selected.size}{/if}
			</p>
		</div>
		<div class="crud-head-actions">
			<select bind:value={status}>
				<option value="all">全部状态</option>
				<option value="published">已发布</option>
				<option value="draft">草稿</option>
			</select>
			<input type="search" placeholder="搜索文章…" bind:value={search} />
			<label class="row-selectall">
				<input
					type="checkbox"
					checked={filtered.length > 0 && selected.size === filtered.length}
					on:change={toggleAll}
				/>
				全选
			</label>
			{#if selected.size > 0}
				<button class="btn-danger-text" on:click={batchDelete} disabled={deleting}>
					{deleting ? "删除中…" : `删除选中 (${selected.size})`}
				</button>
			{/if}
			<a class="btn btn-primary" href="/admin/posts/new/">新建文章</a>
		</div>
	</div>

	<div class="crud-card" style="padding:.6rem 1.25rem">
		{#if loading}
			<div class="list-empty">加载中…</div>
		{:else if error}
			<div class="list-empty error">{error}</div>
		{:else if filtered.length === 0}
			<div class="list-empty">暂无文章</div>
		{:else}
			{#each filtered as post (post.slug)}
				<div class="list-row" class:selected={selected.has(post.slug)}>
					<label class="row-check">
						<input
							type="checkbox"
							checked={selected.has(post.slug)}
							on:change={() => toggle(post.slug)}
						/>
					</label>
					<div class="list-main">
						<div class="list-title">{post.title}</div>
						<div class="list-sub">
							<span>{post.date}</span>
							<span class="mono">{post.slug}</span>
						</div>
					</div>
					{#if post.pin_order}<span class="u-chip pin">置顶</span>{/if}
					{#if post.password}<span class="u-chip lock">加密</span>{/if}
					<span class="u-chip {post.published === 1 ? 'ok' : 'off'}">
						{post.published === 1 ? "已发布" : "草稿"}
					</span>
					<div class="crud-row-actions">
						<a class="btn-ghost" href={`/admin/posts/edit/${encodeURIComponent(post.slug)}/`}>编辑</a>
						<button class="btn-danger-text" on:click={() => remove(post.slug)}>删除</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.row-selectall {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.82rem;
		color: var(--text-muted);
		cursor: pointer;
	}
	.row-selectall input,
	.row-check input {
		accent-color: var(--primary);
	}
	.row-check {
		display: inline-flex;
		flex-shrink: 0;
	}
	.list-row.selected {
		background: color-mix(in oklch, var(--primary) 7%, transparent);
		border-radius: 0.5rem;
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.74rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.u-chip.lock {
		background: var(--btn-regular-bg);
		color: var(--text-muted);
	}
	.list-empty {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--text-muted);
	}
	.list-empty.error {
		color: var(--danger);
	}
	.btn-ghost {
		text-decoration: none;
		border-radius: var(--radius-medium);
		font-size: 0.85rem;
	}
	@media (max-width: 767px) {
		.crud-head-actions {
			width: 100%;
		}
		.list-row {
			flex-wrap: wrap;
		}
	}
</style>
