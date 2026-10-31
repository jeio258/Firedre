<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";
import { clearDraft, getDraft } from "@/lib/adminDrafts";
import { registerSaveAll } from "@/lib/adminSave";
import { onMountAsync } from "@/utils/svelte-mount";
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
	window.location.href = "/admin/gallery/new/";
}

async function remove(slug: string) {
	if (!confirm(`确定删除相册「${slug}」？`)) return;
	try {
		await apiJson(`/api/gallery/${encodeURIComponent(slug)}/`, {
			method: "DELETE",
		});
		albums = albums.filter((a) => a.slug !== slug);
	} catch (err) {
		alert(err instanceof TypeError ? "网络错误" : "删除失败");
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

// 键盘替代：聚焦卡片后用 ←/→ 调整顺序
function moveAlbum(index: number, delta: number) {
	const target = index + delta;
	if (target < 0 || target >= albums.length) return;
	const list = [...albums];
	const [moved] = list.splice(index, 1);
	list.splice(target, 0, moved);
	albums = list;
	dragIndex = target;
	void saveOrder();
}

function onCardKeydown(event: KeyboardEvent, index: number) {
	if (event.key === "ArrowLeft") {
		event.preventDefault();
		moveAlbum(index, -1);
	} else if (event.key === "ArrowRight") {
		event.preventDefault();
		moveAlbum(index, 1);
	}
}

async function saveOrder() {
	if (savingOrder) return true;
	savingOrder = true;
	try {
		await apiJson("/api/gallery/order/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slugs: albums.map((a) => a.slug) }),
		});
		clearDraft("相册排序");
		return true;
	} catch {
		return false;
	} finally {
		savingOrder = false;
	}
}

onMountAsync(async () => {
	await load();
	const d = getDraft<{ albums?: AlbumSummary[] }>("相册排序");
	if (d?.albums) {
		albums = d.albums;
		clearDraft("相册排序");
	}
	return registerSaveAll("相册排序", saveOrder, () => ({ albums }));
});
</script>

<div class="ui-page">
	<div class="ui-head">
		<div>
			<h2 class="ui-title">相册管理</h2>
			<p class="ui-sub">共 {albums.length} 个相册</p>
		</div>
		<div class="ui-acts">
			{#if message}
				<span class="ui-sub">{message}</span>
			{/if}
			<button class="ui-btn ui-btn-primary" onclick={create}>+ 新增相册</button>
		</div>
	</div>

	<AdminPageConfig
		group="gallery"
		enableKey="enabled"
		enableLabel="启用相册页"
		title="相册"
		titleField="title"
	/>

	{#if loading}
		<div class="ui-empty">加载中…</div>
	{:else if albums.length === 0}
		<div class="ui-empty">暂无相册，点击「新增相册」开始。</div>
	{:else}
		<p class="ui-sub sort-hint">拖动卡片调整相册显示顺序，松开即保存；聚焦卡片后用 ←/→ 方向键同样可调整。</p>
		<div class="ui-grid album-grid">
			{#each albums as album, index (album.slug)}
				<a
					class="ui-card album-card"
					class:dragging={dragIndex === index}
					href={editHref(album.slug)}
					draggable="true"
					ondragstart={() => onDragStart(index)}
					ondragover={(e) => onDragOver(e, index)}
					ondrop={onDrop}
					onkeydown={(e) => onCardKeydown(e, index)}
				>
					<div
						class="cover"
						style={album.cover ? `background-image:url('${album.cover}')` : ""}
					>
						{#if !album.cover}
							<span class="glyph">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
									<rect x="3" y="4" width="18" height="16" rx="2" />
									<circle cx="8.5" cy="9.5" r="1.6" />
									<path d="m3 16 5-4 4 3 3-2 6 5" />
								</svg>
							</span>
						{/if}
						<button
							type="button"
							class="ui-btn ui-btn-sm card-del"
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								remove(album.slug);
							}}
						>
							删除
						</button>
					</div>
					<div class="ui-card-b">
						<div class="album-body">
							<strong class="album-name">{album.title}</strong>
							<span class="ui-badge">{album.count ?? 0} 张</span>
						</div>
						{#if album.encrypted || album.source === "webdav"}
							<div class="album-chips">
								{#if album.encrypted}<span class="ui-badge ui-badge-warn">加密</span>{/if}
								{#if album.source === "webdav"}<span class="ui-badge">WebDAV</span>{/if}
							</div>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.sort-hint {
		margin: 0 0 8px;
	}
	.album-card {
		margin: 0;
		display: block;
	}
	.album-card.dragging {
		opacity: 0.6;
	}
	.cover {
		aspect-ratio: 16 / 10;
		background-size: cover;
		background-position: center;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.glyph svg {
		width: 28px;
		height: 28px;
	}
	.card-del {
		position: absolute;
		top: 8px;
		right: 8px;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.album-card:hover .card-del,
	.album-card:focus-within .card-del {
		opacity: 1;
	}
	.album-body {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
	}
	.album-name {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.album-chips {
		display: flex;
		gap: 6px;
		margin-top: 8px;
	}
</style>
