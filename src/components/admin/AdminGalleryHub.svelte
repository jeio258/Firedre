<script lang="ts">
	import { onMount } from "svelte";
	import { apiJson } from "@/lib/adminApi";
	import { registerSaveAll } from "@/lib/adminSave";
	import AdminPageConfig from "./AdminPageConfig.svelte";

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

	function editHref(slug: string) {
		return `/admin/gallery/${encodeURIComponent(slug)}/`;
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
		try {
			await apiJson("/api/gallery/order/", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slugs: albums.map((a) => a.slug) }),
			});
		} catch {
		} finally {
			savingOrder = false;
		}
	}

	onMount(() => {
	load();
	return registerSaveAll("相册排序", saveOrder);
});
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
			<button class="btn-primary" on:click={create}>+ 新增相册</button>
		</div>
	</div>

	<AdminPageConfig
		group="gallery"
		enableKey="enabled"
		enableLabel="启用相册页"
		title="本页设置 · 相册"
		titleField="title"
	/>

	{#if loading}
		<div class="crud-empty">加载中…</div>
	{:else if albums.length === 0}
		<div class="crud-empty">暂无相册，点击「新增相册」开始。</div>
	{:else}
		<p class="sort-hint">拖动卡片调整相册显示顺序，松开即保存。</p>
		<div class="album-grid">
			{#each albums as album, index (album.slug)}
				<a
					class="album-card"
					class:dragging={dragIndex === index}
					href={editHref(album.slug)}
					draggable="true"
					on:dragstart={() => onDragStart(index)}
					on:dragover={(e) => onDragOver(e, index)}
					on:drop={onDrop}
				>
					<div
						class="thumb"
						style={album.cover
							? `background-image:url('${album.cover}')`
							: "background:linear-gradient(135deg,#0e7490,#06b6d4)"}
					>
						{#if !album.cover}
							<span class="img-glyph">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
									<rect x="3" y="4" width="18" height="16" rx="2" />
									<circle cx="8.5" cy="9.5" r="1.6" />
									<path d="m3 16 5-4 4 3 3-2 6 5" />
								</svg>
							</span>
						{/if}
						<button
							type="button"
							class="album-del"
							on:click={(e) => {
								e.preventDefault();
								e.stopPropagation();
								remove(album.slug);
							}}
						>
							删除
						</button>
					</div>
					<div class="album-info">
						<span class="album-name">{album.title}</span>
						<span class="album-count">{album.count ?? 0} 张</span>
					</div>
					{#if album.encrypted || album.source === "webdav"}
						<div class="album-chips">
							{#if album.encrypted}<span class="u-chip on">加密</span>{/if}
							{#if album.source === "webdav"}<span class="u-chip on">WebDAV</span>{/if}
						</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.sort-hint {
		color: var(--text-muted);
		font-size: 0.82rem;
		margin: 0 0 0.4rem;
	}
	.album-card.dragging {
		opacity: 0.6;
	}
	.thumb {
		background-size: cover;
		background-position: center;
		position: relative;
	}
	.album-del {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		border: none;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		font-size: 0.72rem;
		padding: 0.15rem 0.5rem;
		border-radius: 0.4rem;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.album-card:hover .album-del {
		opacity: 1;
	}
	.album-chips {
		display: flex;
		gap: 0.3rem;
		padding: 0 0.9rem 0.7rem;
	}
	.u-chip.on {
		background: color-mix(in oklch, var(--primary) 18%, transparent);
		color: var(--primary);
	}
	@media (max-width: 1023px) {
		.album-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@media (max-width: 640px) {
		.album-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
