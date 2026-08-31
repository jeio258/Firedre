<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

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
let savingOrder = false;

async function load() {
	try {
		const data = await apiJson<{ albums?: AlbumSummary[] }>("/api/gallery/");
		albums = data.albums || [];
	} catch {
		message = "加载失败";
	}
	loading = false;
}

// 创建相册：直接进入创建页，不先填 slug；slug 在创建页保存时必填
function create() {
	window.location.href = `/admin/gallery/new/`;
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

// ── 拖拽排序（方案A：原生 HTML5 drag & drop）──
let dragIndex = -1;

function onDragStart(index: number) {
	dragIndex = index;
}

function onDragOver(event: DragEvent, index: number) {
	event.preventDefault();
	if (index === dragIndex) return;
	// 拖动时实时交换，让列表在拖拽过程中跟随
	const list = [...albums];
	const [moved] = list.splice(dragIndex, 1);
	list.splice(index, 0, moved);
	albums = list;
	dragIndex = index;
}

function onDrop(event: DragEvent) {
	event.preventDefault();
	dragIndex = -1;
	void saveOrder();
}

async function saveOrder() {
	if (savingOrder) return;
	savingOrder = true;
	message = "排序保存中…";
	try {
		await apiJson("/api/gallery/order/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slugs: albums.map((a) => a.slug) }),
		});
		message = "排序已保存 ✓";
	} catch {
		message = "排序保存失败";
	} finally {
		savingOrder = false;
	}
}

onMount(load);
</script>

<div class="admin-card">
	<div class="toolbar">
		<h2>相册管理</h2>
		<div class="create">
			<button class="btn-primary" on:click={create}>创建相册</button>
		</div>
	</div>

	{#if message}
		<p class="msg">{message}</p>
	{/if}

	{#if loading}
		<p class="hint">加载中…</p>
	{:else if albums.length === 0}
		<p class="hint">暂无相册</p>
	{:else}
		<p class="sort-hint">拖动左侧手柄调整相册显示顺序，松开即保存。</p>
		<table>
			<thead>
				<tr>
					<th class="drag-col" aria-label="排序"></th>
					<th>相册</th>
					<th>Slug</th>
					<th>日期</th>
					<th>照片</th>
					<th>状态</th>
					<th>操作</th>
				</tr>
			</thead>
			<tbody>
				{#each albums as album, index (album.slug)}
					<tr
						draggable="true"
						class:dragging={dragIndex === index}
						on:dragstart={() => onDragStart(index)}
						on:dragover={(e) => onDragOver(e, index)}
						on:drop={onDrop}
					>
						<td class="drag-col">
							<span class="drag-handle" title="拖拽排序">⠿</span>
						</td>
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
	.toolbar {
		gap: 1rem;
	}
	.create {
		display: flex;
		gap: 0.5rem;
	}
	.sort-hint {
		color: var(--muted, #6b7280);
		font-size: 0.82rem;
		margin: 0.2rem 0 0.4rem;
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
	.drag-col {
		width: 2rem;
	}
	.drag-handle {
		cursor: grab;
		color: var(--muted, #9ca3af);
		font-size: 1.1rem;
		user-select: none;
		display: inline-block;
	}
	tr.dragging {
		opacity: 0.6;
		background: var(--line-divider, #f9fafb);
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
