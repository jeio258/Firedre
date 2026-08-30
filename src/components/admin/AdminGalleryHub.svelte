<script lang="ts">
import { onMount } from "svelte";

type AlbumSummary = {
	slug: string;
	title: string;
	date?: string;
	count?: number;
	encrypted?: boolean;
	source?: string;
	cover?: string;
};

let albums: AlbumSummary[] = [];
let loading = true;
let message = "";
let newSlug = "";

async function load() {
	try {
		const resp = await fetch("/api/gallery/");
		if (resp.ok) {
			const data = await resp.json();
			albums = data.albums || [];
		}
	} catch {
		message = "加载失败";
	}
	loading = false;
}

function create() {
	const slug = newSlug.trim();
	if (!slug) {
		alert("请输入相册 slug");
		return;
	}
	window.location.href = `/admin/gallery/${encodeURIComponent(slug)}/`;
}

async function remove(slug: string) {
	if (!confirm(`确定删除相册「${slug}」？`)) return;
	try {
		const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/`, {
			method: "DELETE",
		});
		if (resp.ok) {
			albums = albums.filter((a) => a.slug !== slug);
		} else {
			alert("删除失败");
		}
	} catch {
		alert("网络错误");
	}
}

onMount(load);
</script>

<div class="admin-card">
	<div class="toolbar">
		<h2>相册管理</h2>
		<div class="create">
			<input type="text" placeholder="新相册 slug（如 my-album）" bind:value={newSlug} />
			<button class="btn-primary" on:click={create}>创建相册</button>
		</div>
	</div>

	{#if loading}
		<p class="hint">加载中…</p>
	{:else if albums.length === 0}
		<p class="hint">暂无相册</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>相册</th>
					<th>Slug</th>
					<th>日期</th>
					<th>照片</th>
					<th>状态</th>
					<th>操作</th>
				</tr>
			</thead>
			<tbody>
				{#each albums as album}
					<tr>
						<td>
							{#if album.cover}
								<img src={album.cover} alt="" width="40" height="40" />
							{/if}
							{album.title}
						</td>
						<td class="mono">{album.slug}</td>
						<td>{album.date || "-"}</td>
						<td>{album.count ?? "-"}</td>
						<td>
							{#if album.encrypted}
								<span class="tag">加密</span>
							{/if}
							{#if album.source === "webdav"}
								<span class="tag">WebDAV</span>
							{/if}
						</td>
						<td class="ops">
							<a href={`/admin/gallery/${encodeURIComponent(album.slug)}/`}>编辑</a>
							<button class="danger" on:click={() => remove(album.slug)}>删除</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.admin-card {
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: var(--radius-large, 0.75rem);
		padding: 1.25rem;
	}
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
	.create {
		display: flex;
		gap: 0.5rem;
	}
	input {
		padding: 0.45rem 0.7rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg, #fff);
		color: var(--deep-text, inherit);
	}
	.btn-primary {
		padding: 0.45rem 0.9rem;
		background: var(--primary, #5b8cff);
		color: var(--btn-content, #fff);
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid var(--line-divider, #f3f4f6);
	}
	img {
		border-radius: 0.35rem;
		object-fit: cover;
		vertical-align: middle;
		margin-right: 0.5rem;
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
		color: var(--muted, #6b7280);
		margin-right: 0.3rem;
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
</style>
