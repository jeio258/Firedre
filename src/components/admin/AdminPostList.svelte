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

let posts = $state<PostItem[]>([]);
let loading = $state(true);
let error = $state("");
let search = $state("");
let status = $state("all"); // all | published | draft
let selected = $state(new Set<string>());
let deleting = $state(false);

async function load() {
	loading = true;
	error = "";
	try {
		const data = await apiJson<{ posts?: PostItem[] }>(
			"/api/posts/?pageSize=200",
		);
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
	if (!confirm(`确定删除选中的 ${list.length} 篇文章？此操作不可恢复。`))
		return;
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

let filtered = $derived(
	posts.filter((p) => {
		const hitSearch =
			!search ||
			p.title.toLowerCase().includes(search.toLowerCase()) ||
			p.slug.toLowerCase().includes(search.toLowerCase());
		const hitStatus =
			status === "all" ||
			(status === "published" ? p.published === 1 : p.published === 0);
		return hitSearch && hitStatus;
	}),
);
let publishedCount = $derived(posts.filter((p) => p.published === 1).length);
let draftCount = $derived(posts.length - publishedCount);
</script>

<div class="ui-page">
	<div class="ui-head">
		<div>
			<h2 class="ui-title">文章管理</h2>
			<p class="ui-sub">
				共 <b>{posts.length}</b> 篇 · 已发布 <b>{publishedCount}</b> · 草稿 <b>{draftCount}</b>
				{#if selected.size > 0}· 已选 {selected.size}{/if}
			</p>
		</div>
		<div class="ui-acts">
			<a class="ui-btn ui-btn-primary" href="/admin/posts/new/">新建文章</a>
		</div>
	</div>

	<div class="ui-card">
		<div class="ui-card-h">
			<span>文章列表</span>
			<div class="ui-acts">
				{#if selected.size > 0}
					<button
						class="ui-btn ui-btn-sm"
						onclick={batchDelete}
						disabled={deleting}
					>
						{deleting ? "删除中…" : `删除选中 (${selected.size})`}
					</button>
				{/if}
			</div>
		</div>

		<div class="ui-card-b">
			<div class="ui-grid">
				<div class="ui-field">
					<label class="ui-label" for="post-status">状态</label>
					<select
						id="post-status"
						class="ui-select"
						aria-label="筛选文章状态"
						bind:value={status}
					>
						<option value="all">全部状态</option>
						<option value="published">已发布</option>
						<option value="draft">草稿</option>
					</select>
				</div>
				<div class="ui-field">
					<label class="ui-label" for="post-search">搜索</label>
					<input
						id="post-search"
						class="ui-input"
						type="search"
						aria-label="搜索文章"
						placeholder="搜索文章…"
						bind:value={search}
					/>
				</div>
			</div>
		</div>

		{#if loading}
			<div class="ui-empty">加载中…</div>
		{:else if error}
			<div class="ui-empty">{error}</div>
		{:else if filtered.length === 0}
			<div class="ui-empty">暂无文章</div>
		{:else}
			<table class="ui-table">
				<thead>
					<tr>
						<th>
							<input
								type="checkbox"
								aria-label="全选文章"
								checked={filtered.length > 0 &&
									selected.size === filtered.length}
								onchange={toggleAll}
							/>
						</th>
						<th>标题</th>
						<th>状态</th>
						<th>操作</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as post (post.slug)}
						<tr>
							<td>
								<input
									type="checkbox"
									aria-label={`选择文章：${post.title}`}
									checked={selected.has(post.slug)}
									onchange={() => toggle(post.slug)}
								/>
							</td>
							<td>
								<div>{post.title}</div>
								<div class="ui-sub">{post.date} · {post.slug}</div>
							</td>
							<td>
								<div class="ui-acts">
									{#if post.pin_order}<span class="ui-badge ui-badge-warn">置顶</span>{/if}
									{#if post.password}<span class="ui-badge">加密</span>{/if}
									<span class="ui-badge">{post.published === 1 ? "已发布" : "草稿"}</span>
								</div>
							</td>
							<td>
								<div class="ui-acts">
									<a class="ui-btn ui-btn-sm ui-btn-ghost" href={`/admin/posts/edit/${encodeURIComponent(post.slug)}/`}>编辑</a>
									<button class="ui-btn ui-btn-sm ui-btn-ghost" onclick={() => remove(post.slug)}>删除</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
