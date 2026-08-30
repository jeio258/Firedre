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

export let section = "posts";

let posts: PostItem[] = [];
let loading = true;
let error = "";
let search = "";

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
	try {
		const resp = await fetch(`/api/posts/${encodeURIComponent(slug)}/`, {
			method: "DELETE",
		});
		if (resp.ok) {
			posts = posts.filter((p) => p.slug !== slug);
		} else {
			const data = await resp.json();
			alert(data.message || "删除失败");
		}
	} catch {
		alert("网络错误");
	}
}

onMount(load);

$: filtered = posts.filter(
	(p) =>
		!search ||
		p.title.toLowerCase().includes(search.toLowerCase()) ||
		p.slug.toLowerCase().includes(search.toLowerCase()),
);
</script>

<div class="admin-card">
	<div class="toolbar">
		<h2>文章管理（{posts.length}）</h2>
		<div class="actions">
			<input type="search" placeholder="搜索标题/slug…" bind:value={search} />
			<a class="btn btn-primary" href="/admin/posts/new/">+ 新建文章</a>
		</div>
	</div>

	{#if loading}
		<p class="hint">加载中…</p>
	{:else if error}
		<p class="hint error">{error}</p>
	{:else if filtered.length === 0}
		<p class="hint">暂无文章</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>标题</th>
					<th>Slug</th>
					<th>日期</th>
					<th>状态</th>
					<th>操作</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as post}
					<tr>
						<td>
							{post.title}
							{#if post.pin_order}
								<span class="tag">置顶</span>
							{/if}
							{#if post.password}
								<span class="tag">加密</span>
							{/if}
						</td>
						<td class="mono">{post.slug}</td>
						<td>{post.date}</td>
						<td>{post.published ? "已发布" : "草稿"}</td>
						<td class="ops">
							<a href={`/admin/posts/edit/${encodeURIComponent(post.slug)}/`}>编辑</a>
							<button class="danger" on:click={() => remove(post.slug)}>删除</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		gap: 1rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0;
		color: var(--deep-text, inherit);
	}
	.actions {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}
	input {
		padding: 0.45rem 0.7rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg, #fff);
		color: var(--deep-text, inherit);
	}
	.btn {
		padding: 0.45rem 0.8rem;
		border-radius: 0.4rem;
		text-decoration: none;
		font-size: 0.9rem;
	}
	.btn-primary {
		background: var(--primary, #5b8cff);
		color: #fff;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.55rem 0.6rem;
		border-bottom: 1px solid var(--line-divider, #f3f4f6);
	}
	th {
		color: var(--muted, #6b7280);
		font-weight: 600;
		font-size: 0.8rem;
	}
	td {
		color: var(--deep-text, inherit);
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.82rem;
	}
	.tag {
		background: var(--btn-regular-bg, #f3f4f6);
		border-radius: 0.3rem;
		padding: 0.1rem 0.4rem;
		font-size: 0.72rem;
		margin-left: 0.35rem;
		color: var(--muted, #6b7280);
	}
	.ops {
		display: flex;
		gap: 0.6rem;
	}
	.ops a {
		color: var(--primary, #5b8cff);
		text-decoration: none;
	}
	.danger {
		background: none;
		border: none;
		color: #dc2626;
		cursor: pointer;
		font-size: 0.9rem;
		padding: 0;
	}
	.hint {
		color: var(--muted, #6b7280);
		padding: 1rem 0;
	}
	.hint.error {
		color: #dc2626;
	}
</style>
