<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";
import { registerSaveAll } from "@/lib/adminSave";
import Switch from "./Switch.svelte";

let { slug = "" } = $props();

let isNew = $derived(slug === "");

let loaded = $state(false);
let saving = $state(false);
let message = $state("");

let newSlug = $state("");

let hadEncrypted = $state(false);

let formTitle = $state("");
let formDate = $state("");
let formLocation = $state("");
let formTags = $state("");
let formCover = $state("");
let formDesc = $state("");

let photosText = $state("");
let photos: Array<{
	url: string;
	type?: string;
	poster?: string;
	date?: string;
}> = $state([]);

let hasPassword = $state(false);
let passwordInput = $state("");
let passwordMsg = $state("");
let passwordSaving = $state(false);

let imgbedEnabled = $state(false);
let imgbedEndpoint = $state("");
let imgbedDir = $state("");
let imgbedDirSaving = $state(false);
let imgbedDirMsg = $state("");
let imgbedMsg = $state("");
let imgbedFetching = $state(false);

function parsePhotosText(text: string) {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [url, ...rest] = line.split(/\s+/);
			const meta = rest[0] || "";
			return {
				url,
				type: meta === "video" || meta === "image" ? meta : undefined,
			};
		});
}

function photosToText(list: Array<{ url: string; type?: string }>) {
	return list.map((p) => (p.type ? `${p.url} ${p.type}` : p.url)).join("\n");
}

async function loadImgbedStatus() {
	try {
		const data = await apiJson<{
			imgbedEnabled?: boolean;
			imgbedEndpoint?: string;
			imgbedDir?: string;
		}>("/api/settings/?group=gallery");
		imgbedEnabled = data.imgbedEnabled === true;
		imgbedEndpoint = data.imgbedEndpoint ?? "";
		imgbedDir = data.imgbedDir ?? "";
	} catch {
		// 读取失败保持默认状态
	}
}

async function saveImgbedDir() {
	imgbedDirSaving = true;
	imgbedDirMsg = "";
	try {
		await apiJson("/api/settings/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				group: "gallery",
				data: { imgbedDir: imgbedDir.trim() },
			}),
		});
		imgbedDirMsg = "已保存图床目录（留空 = 根目录）";
	} catch (err) {
		imgbedDirMsg = err instanceof Error ? err.message : "网络错误";
	} finally {
		imgbedDirSaving = false;
	}
}

async function fetchFromImgbed() {
	imgbedFetching = true;
	imgbedMsg = "";
	const targetSlug = (isNew ? newSlug.trim() : slug).trim();
	if (!targetSlug) {
		imgbedMsg = "请先填写相册 slug，再拉取图床图片";
		imgbedFetching = false;
		return;
	}
	try {
		const data = await apiJson<{ count?: number }>(
			`/api/gallery/${encodeURIComponent(targetSlug)}/imgbed/photos/`,
			{ method: "POST" },
		);
		imgbedMsg = `已从图床获取 ${data.count} 张图片`;
		await load();
	} catch (err) {
		imgbedMsg = err instanceof Error ? err.message : "网络错误";
	} finally {
		imgbedFetching = false;
	}
}

async function loadPasswordState() {
	try {
		const data = await apiJson<{ hasPassword?: boolean }>(
			`/api/gallery/${encodeURIComponent(slug)}/password/`,
		);
		hasPassword = !!data.hasPassword;
	} catch {
		// 读取失败保持默认未设置状态
	}
}

async function savePassword() {
	passwordSaving = true;
	passwordMsg = "";
	try {
		const data = await apiJson<{ hasPassword?: boolean }>(
			`/api/gallery/${encodeURIComponent(slug)}/password/`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password: passwordInput }),
			},
		);
		hasPassword = !!data.hasPassword;
		passwordInput = "";
		passwordMsg = hasPassword ? "已设置相册密码" : "已清除相册密码";
	} catch (err) {
		passwordMsg = err instanceof Error ? err.message : "网络错误";
	} finally {
		passwordSaving = false;
	}
}

async function clearPassword() {
	passwordSaving = true;
	passwordMsg = "";
	try {
		await apiJson(`/api/gallery/${encodeURIComponent(slug)}/password/`, {
			method: "DELETE",
		});
		hasPassword = false;
		passwordInput = "";
		passwordMsg = "已清除相册密码";
	} catch (err) {
		passwordMsg = err instanceof Error ? err.message : "网络错误";
	} finally {
		passwordSaving = false;
	}
}

async function load() {
	if (!isNew) {
		try {
			const data = await apiJson<{ frontmatter?: Record<string, unknown> }>(
				`/api/gallery/${encodeURIComponent(slug)}/`,
			);
			const fm = data?.frontmatter || {};
			formTitle = String(fm.title || "");
			formDate = String(fm.date || "");
			formLocation = String(fm.location || "");
			formTags = Array.isArray(fm.tags) ? fm.tags.join(", ") : "";
			formCover = String(fm.cover || "");
			formDesc = String(fm.desc || "");
			hadEncrypted = fm.encrypted === true;
			photos = Array.isArray(fm.photos)
				? (
						fm.photos as Array<{
							url: string;
							type?: string;
							poster?: string;
							date?: string;
						}>
					).filter((p) => p?.url)
				: [];
			photosText = photosToText(photos);
		} catch (err) {
			message = err instanceof TypeError ? "网络错误" : "加载失败";
		}
	}
	loaded = true;
	loadPasswordState();
	loadImgbedStatus();
}

function buildFrontmatter() {
	const fm: Record<string, unknown> = {
		layout: "gallery-album",
		source: "local",
	};
	if (formTitle.trim()) fm.title = formTitle.trim();
	if (formDate.trim()) fm.date = formDate.trim();
	if (formLocation.trim()) fm.location = formLocation.trim();
	if (formCover.trim()) fm.cover = formCover.trim();
	if (formDesc.trim()) fm.desc = formDesc.trim();
	if (hadEncrypted) fm.encrypted = true;
	const tags = formTags
		.split(/[,，]/)
		.map((t) => t.trim())
		.filter(Boolean);
	if (tags.length) fm.tags = tags;
	const parsedPhotos = parsePhotosText(photosText);
	if (parsedPhotos.length) fm.photos = parsedPhotos;
	return fm;
}

async function save() {
	saving = true;
	message = "";
	let targetSlug = slug;
	if (isNew) {
		targetSlug = newSlug.trim();
		if (!targetSlug) {
			message = "请填写相册 slug";
			saving = false;
			return false;
		}
	}
	const fm = buildFrontmatter();
	try {
		await apiJson(`/api/gallery/${encodeURIComponent(targetSlug)}/`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ frontmatter: fm, content: "" }),
		});
		if (isNew) {
			window.location.href = `/admin/gallery/${encodeURIComponent(targetSlug)}/`;
			return true;
		}
		message = "已保存";
		return true;
	} catch (err) {
		message = err instanceof Error ? err.message : "网络错误";
		return false;
	} finally {
		saving = false;
	}
}

async function removeAlbum() {
	if (!confirm(`确定删除相册「${slug}」？此操作不可恢复。`)) return;
	saving = true;
	try {
		await apiJson(`/api/gallery/${encodeURIComponent(slug)}/`, {
			method: "DELETE",
		});
		window.location.href = "/admin/gallery/";
		return;
	} catch (err) {
		message = err instanceof TypeError ? "网络错误" : "删除失败";
	} finally {
		saving = false;
	}
}

onMount(() => {
	load();
	return registerSaveAll("相册", save);
});
</script>

<div class="ui-page">
	<div class="ui-head">
		<div>
			<h2 class="ui-title">{isNew ? "创建相册" : `相册：${slug}`}</h2>
			<p class="ui-sub">
				<a href="/admin/gallery/">← 返回相册列表</a>
			</p>
		</div>
		<div class="ui-acts">
			{#if isNew}
				<input class="ui-input slug-input" type="text" bind:value={newSlug} placeholder="相册 slug（必填）" autocomplete="off" />
			{/if}
			{#if message}
				<span class="ui-sub">{message}</span>
			{/if}
			{#if !isNew}
				<button class="ui-btn" onclick={removeAlbum} disabled={saving}>删除相册</button>
			{/if}
			<button class="ui-btn ui-btn-primary" onclick={save} disabled={saving}>
				{saving ? "保存中…" : isNew ? "创建" : "保存"}
			</button>
		</div>
	</div>

	{#if loaded}
		<div class="editor-layout">
			<div>
				<section class="ui-card">
					<div class="ui-card-h">
						照片
						<span class="ui-sub">点击可预览</span>
					</div>
					<div class="ui-card-b">
						{#if photos.length}
							<div class="photo-grid">
								{#each photos as p}
									<div
										class="photo-tile"
										style={p.url ? `background-image:url('${p.url}')` : ""}
									>
										{#if p.type === "video"}<span class="ui-badge tile-tag">视频</span>{/if}
									</div>
								{/each}
							</div>
						{:else}
							<div class="ui-empty">暂无照片，在下方粘贴图片地址或从图床获取</div>
						{/if}
						<label class="ui-field field-wide">
							<span class="ui-label">照片列表（每行一个 URL，可选 type）</span>
							<textarea class="ui-input area" rows="6" bind:value={photosText} placeholder={"https://…/1.jpg\nhttps://…/2.jpg video"}></textarea>
						</label>
						{#if imgbedEnabled}
							<div class="row-flex">
								<span class="ui-sub">
									图床：{imgbedEndpoint || "（未设置端点）"} ｜ 目录：{imgbedDir || "（根目录）"}
								</span>
								<button class="ui-btn ui-btn-primary" onclick={fetchFromImgbed} disabled={imgbedFetching}>
									{imgbedFetching ? "拉取中…" : "从图床获取图片"}
								</button>
							</div>
						{:else}
							<p class="ui-sub">
								图床 API 未启用。请先在<a href="/admin/settings/">站点设置 → 相册</a>配置「图床 API 端点 + 密钥」并启用。
							</p>
						{/if}
						{#if imgbedMsg}
							<p class="ui-sub">{imgbedMsg}</p>
						{/if}
					</div>
				</section>

				<section class="ui-card">
					<div class="ui-card-h">访问密码与图床</div>
					<div class="ui-card-b">
						<label class="ui-field field-tall">
							<span class="ui-label">相册访问密码（存 D1，不写入文件）</span>
							<div class="row-flex">
								<input class="ui-input" type="password" bind:value={passwordInput} placeholder={hasPassword ? "已设置密码，输入新密码可修改" : "设置访问密码"} autocomplete="off" />
								<button class="ui-btn ui-btn-primary" onclick={savePassword} disabled={passwordSaving}>
									{passwordSaving ? "保存中…" : "保存密码"}
								</button>
								{#if hasPassword}
									<button class="ui-btn ui-btn-ghost" onclick={clearPassword} disabled={passwordSaving}>清除密码</button>
								{/if}
							</div>
						</label>
						<label class="ui-field field-tall">
							<span class="ui-label">图床目录 ?dir=（留空=根目录）</span>
							<div class="row-flex">
								<input class="ui-input" type="text" bind:value={imgbedDir} placeholder="图床目录 ?dir=" autocomplete="off" />
								<button class="ui-btn ui-btn-primary" onclick={saveImgbedDir} disabled={imgbedDirSaving}>
									{imgbedDirSaving ? "保存中…" : "保存目录"}
								</button>
							</div>
						</label>
						{#if passwordMsg}
							<p class="ui-sub">{passwordMsg}</p>
						{/if}
						{#if imgbedDirMsg}
							<p class="ui-sub">{imgbedDirMsg}</p>
						{/if}
					</div>
				</section>
			</div>

			<div>
				<section class="ui-card">
					<div class="ui-card-h">相册信息</div>
					<div class="ui-card-b">
						<div class="stack-fields">
							<label class="ui-field">
								<span class="ui-label">名称</span>
								<input class="ui-input" type="text" bind:value={formTitle} placeholder="相册标题" autocomplete="off" />
							</label>
							<label class="ui-field">
								<span class="ui-label">封面备注</span>
								<input class="ui-input" type="text" bind:value={formCover} placeholder="封面图片地址（可选）" autocomplete="off" />
							</label>
							<label class="ui-field">
								<span class="ui-label">访问路径</span>
								{#if isNew}
									<input class="ui-input" type="text" bind:value={newSlug} placeholder="english-slug" autocomplete="off" />
								{:else}
									<input class="ui-input" type="text" value={slug} disabled />
								{/if}
							</label>
							<label class="ui-field">
								<span class="ui-label">日期</span>
								<input class="ui-input" type="text" bind:value={formDate} placeholder="如 2026-08-31" autocomplete="off" />
							</label>
							<label class="ui-field">
								<span class="ui-label">地点</span>
								<input class="ui-input" type="text" bind:value={formLocation} placeholder="如 杭州市" autocomplete="off" />
							</label>
							<label class="ui-field">
								<span class="ui-label">标签（逗号分隔）</span>
								<input class="ui-input" type="text" bind:value={formTags} placeholder="如 旅行, 风景" autocomplete="off" />
							</label>
							<label class="ui-field field-wide">
								<span class="ui-label">描述</span>
								<textarea class="ui-input area" rows="3" bind:value={formDesc} placeholder="相册描述（可选）"></textarea>
							</label>
							<label class="check-line">
								<Switch on={hadEncrypted} label="加密相册" toggle={() => (hadEncrypted = !hadEncrypted)} />
								<span class="check-text">加密相册</span>
							</label>
						</div>
					</div>
				</section>
			</div>
		</div>
	{:else}
		<div class="ui-empty">{message || "加载中…"}</div>
	{/if}
</div>

<style>
	.slug-input {
		width: 220px;
	}
	.stack-fields {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.field-wide {
		grid-template-rows: 18px auto;
	}
	.ui-card-b > .field-wide {
		margin-top: 12px;
	}
	.field-tall {
		grid-template-rows: 18px auto;
	}
	.area {
		height: auto;
		min-height: 96px;
		resize: vertical;
	}
	.row-flex {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.row-flex .ui-input {
		flex: 1 1 180px;
	}
	.photo-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 8px;
	}
	.photo-tile {
		aspect-ratio: 1;
		background-size: cover;
		background-position: center;
		position: relative;
		overflow: hidden;
	}
	.tile-tag {
		position: absolute;
		bottom: 4px;
		right: 4px;
	}
	@media (max-width: 767px) {
		.slug-input {
			width: 100%;
		}
		.photo-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>