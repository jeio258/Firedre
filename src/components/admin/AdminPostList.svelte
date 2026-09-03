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
		const resp = await fetch(`/api/posts/${encodeURIComponent(slug)}/`, {
			method: "DELETE",
		});
		if (resp.ok) return true;
		const data = await resp.json();
		alert(data.message || "删除失败");
		return false;
	} catch {
		alert("网络错误");
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

<div class="pl-page">
	<div class="dash-card pl-toolbar">
		<div class="pl-toolbar-top">
			<div>
				<h2>文章管理</h2>
				<p class="pl-sub">共 {posts.length} 篇 · 已发布 {publishedCount} · 草稿 {draftCount}</p>
			</div>
			<a class="btn-primary" href="/admin/posts/new/">+ 新建文章</a>
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
		<div class="dash-card pl-table-card">
			<div class="pl-table-wrap">
				<table>
					<thead>
						<tr>
							<th class="chk"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} on:change={toggleAll} /></th>
							<th>标题</th>
							<th>Slug</th>
							<th>日期</th>
							<th>状态</th>
							<th class="ops-col">操作</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as post (post.slug)}
							<tr class:selected={selected.has(post.slug)}>
								<td class="chk">
									<input type="checkbox" checked={selected.has(post.slug)} on:change={() => toggle(post.slug)} />
								</td>
								<td>
									<span class="title-cell">{post.title}</span>
									{#if post.pin_order}<span class="badge amber">置顶</span>{/if}
									{#if post.password}<span class="badge slate">加密</span>{/if}
								</td>
								<td class="mono">{post.slug}</td>
								<td>{post.date}</td>
								<td>
									{#if post.published === 1}
										<span class="badge published">已发布</span>
									{:else}
										<span class="badge draft">草稿</span>
									{/if}
								</td>
								<td class="ops-col">
									<div class="ops">
										<a class="op-link" href={`/admin/posts/edit/${encodeURIComponent(post.slug)}/`}>编辑</a>
										<button class="op-del" on:click={() => remove(post.slug)}>删除</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
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
	.pl-table-card {
		padding: 0;
		overflow: hidden;
	}
	.pl-table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
		min-width: 640px;
	}
	th,
	td {
		text-align: left;
		padding: 0.65rem 0.9rem;
		border-bottom: 1px solid var(--line-divider);
	}
	thead th {
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.76rem;
		background: var(--btn-regular-bg);
	}
	tbody tr:last-child td {
		border-bottom: none;
	}
	tbody tr.selected {
		background: color-mix(in oklch, var(--primary) 6%, transparent);
	}
	td {
		color: var(--deep-text);
	}
	.chk {
		width: 2rem;
	}
	.chk input {
		accent-color: var(--primary);
	}
	.title-cell {
		font-weight: 500;
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.badge {
		display: inline-block;
		margin-left: 0.4rem;
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
	.ops {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}
	.ops-col {
		width: 8rem;
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
</style>
