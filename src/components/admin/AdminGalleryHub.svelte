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

	let albums: AlbumSummary[] = $state([]);
	let loading = $state(true);
	let message = $state("");
	let savingOrder = $state(false);

	async function load() {
		try {
			const data = await apiJson<{ albums?: AlbumSummary[] }>("/api/gallery/");
			albums = data.albums || [];
		} catch {
			message = "加载失败";
		}
		loading = false;
	}

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

	let dragIndex = $state(-1);

	function onDragStart(index: number) {
		dragIndex = index;
	}

	function onDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (index === dragIndex) return;
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
			message = "排序已保存";
		} catch {
			message = "排序保存失败";
		} finally {
			savingOrder = false;
		}
	}

	onMount(load);
</script>

<div class="crud-page">
	<div class="crud-head">
		<div>
			<h2>相册管理</h2>
			<p class="crud-sub">共 {albums.length} 个相册</p>
		</div>
		<div class="crud-head-actions">
			{#if message}
				<span class="crud-msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={create}>创建相册</button>
		</div>
	</div>

	{#if loading}
		<div class="crud-empty">加载中…</div>
	{:else if albums.length === 0}
		<div class="crud-empty">暂无相册，点击「创建相册」开始。</div>
	{:else}
		<p class="sort-hint">拖动左侧手柄调整相册显示顺序，松开即保存。</p>
		<div class="crud-card no-pad">
			<div class="table-wrap">
				<table class="hub-table">
					<colgroup>
						<col style="width: 36px" />
						<col />
						<col style="width: 150px" />
						<col style="width: 116px" />
						<col style="width: 64px" />
						<col style="width: 96px" />
						<col style="width: 158px" />
					</colgroup>
					<thead>
						<tr>
							<th class="drag-col" aria-label="排序"></th>
							<th class="album-col">相册</th>
							<th>Slug</th>
							<th>日期</th>
							<th>照片</th>
							<th>状态</th>
							<th class="ops-col">操作</th>
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
								<td class="album-col">
									<div class="album-cell">
										{#if album.cover}
											<img src={album.cover} alt="" width="36" height="36" class="album-cover" />
										{:else}
											<span class="album-cover ph"></span>
										{/if}
										<span class="album-title">{album.title}</span>
									</div>
								</td>
								<td class="mono slug-cell" title={album.slug}>{album.slug}</td>
								<td class="cell-nowrap">{album.date || "-"}</td>
								<td class="cell-nowrap">{album.count ?? "-"}</td>
								<td class="chips">
									{#if album.encrypted}
										<span class="u-chip on">加密</span>
									{/if}
									{#if album.source === "webdav"}
										<span class="u-chip on">WebDAV</span>
									{/if}
								</td>
								<td class="crud-row-actions">
									<a class="btn-ghost" href={`/admin/gallery/${encodeURIComponent(album.slug)}/`}>编辑</a>
									<button class="btn-danger-text" on:click={() => remove(album.slug)}>删除</button>
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
	.sort-hint {
		color: var(--text-muted);
		font-size: 0.82rem;
		margin: 0 0 0.4rem;
	}
	.crud-card.no-pad {
		padding: 0;
		overflow: hidden;
	}
	.table-wrap {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}
	.hub-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		font-size: 0.88rem;
	}
	.hub-table th,
	.hub-table td {
		text-align: left;
		padding: 0.6rem 0.7rem;
		border-bottom: 1px solid var(--line-divider);
		color: var(--deep-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hub-table .album-col {
		white-space: normal;
	}
	.hub-table thead th {
		background: var(--btn-regular-bg);
		font-weight: 600;
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.hub-table tbody tr:last-child td {
		border-bottom: none;
	}
	.cell-nowrap {
		white-space: nowrap;
	}
	.slug-cell {
		font-family: ui-monospace, monospace;
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.drag-col {
		width: 2.2rem;
	}
	.ops-col {
		width: 8.5rem;
	}
	.album-cell {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
	}
	.album-cover {
		border-radius: 0.4rem;
		object-fit: cover;
		flex-shrink: 0;
		background: var(--btn-regular-bg);
	}
	.album-cover.ph {
		display: inline-block;
		width: 36px;
		height: 36px;
	}
	.album-title {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.chips {
		display: flex;
		gap: 0.3rem;
		white-space: nowrap;
	}

	.u-chip.on {
		background: color-mix(in oklch, var(--primary) 18%, transparent);
		color: var(--primary);
	}
	.drag-handle {
		cursor: grab;
		color: var(--text-muted);
		font-size: 1.1rem;
		user-select: none;
	}
	tr.dragging {
		opacity: 0.6;
		background: var(--btn-regular-bg);
	}


	@media (max-width: 767px) {
		.hub-table {
			min-width: 560px;
		}
	}
</style>