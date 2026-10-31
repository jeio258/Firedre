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
let imgbedToken = $state("");
let imgbedDir = $state("");
let imgbedSaving = $state(false);
let imgbedTesting = $state(false);
let imgbedMsg = $state("");
let imgbedTestMsg = $state("");
let imgbedFetching = $state(false);

type UploadStatus = "pending" | "uploading" | "done" | "error";
type UploadItem = {
	id: number;
	file: File;
	status: UploadStatus;
	progress: number;
	error: string;
};
let uploadOpen = $state(false);
let uploading = $state(false);
let uploadQueue: UploadItem[] = $state([]);
let uploadIdSeq = 0;
let fileInput: HTMLInputElement | null = $state(null);

let uploadBig = $derived(
	uploadQueue.length > 3 ||
		uploadQueue.some((i) => i.file.size > 8 * 1024 * 1024),
);
let uploadDone = $derived(
	uploadQueue.filter((i) => i.status === "done").length,
);
let uploadCurrent = $derived(
	uploadQueue.find((i) => i.status === "uploading")?.file.name ?? "",
);
let uploadPercent = $derived(
	uploadQueue.length
		? Math.round(
				uploadQueue.reduce(
					(sum, i) =>
						sum +
						(i.status === "done"
							? 100
							: i.status === "uploading"
								? i.progress
								: 0),
					0,
				) / uploadQueue.length,
			)
		: 0,
);

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
			imgbedToken?: string;
			imgbedDir?: string;
		}>("/api/settings/?group=gallery");
		imgbedEnabled = data.imgbedEnabled === true;
		imgbedEndpoint = data.imgbedEndpoint ?? "";
		imgbedToken = data.imgbedToken ?? "";
		imgbedDir = data.imgbedDir ?? "";
	} catch {
		// 读取失败保持默认状态
	}
}

async function saveImgbed() {
	imgbedSaving = true;
	imgbedMsg = "";
	imgbedTestMsg = "";
	try {
		await apiJson("/api/settings/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				group: "gallery",
				data: {
					imgbedEnabled: true,
					imgbedEndpoint: imgbedEndpoint.trim(),
					imgbedToken: imgbedToken.trim(),
					imgbedDir: imgbedDir.trim(),
				},
			}),
		});
		imgbedEnabled = true;
		imgbedMsg = "已保存并启用图床 API";
	} catch (err) {
		imgbedMsg = err instanceof Error ? err.message : "网络错误";
	} finally {
		imgbedSaving = false;
	}
}

async function disableImgbed() {
	imgbedSaving = true;
	imgbedMsg = "";
	try {
		await apiJson("/api/settings/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				group: "gallery",
				data: { imgbedEnabled: false },
			}),
		});
		imgbedEnabled = false;
		imgbedMsg = "已禁用图床 API";
	} catch (err) {
		imgbedMsg = err instanceof Error ? err.message : "网络错误";
	} finally {
		imgbedSaving = false;
	}
}

async function testImgbed() {
	imgbedTesting = true;
	imgbedTestMsg = "";
	try {
		const data = await apiJson<{ count?: number }>(
			"/api/gallery/imgbed-test/",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					endpoint: imgbedEndpoint.trim(),
					token: imgbedToken.trim(),
					dir: imgbedDir.trim(),
				}),
			},
		);
		imgbedTestMsg = `已连接 · 图床内 ${data.count ?? 0} 个文件`;
	} catch (err) {
		imgbedTestMsg = err instanceof Error ? err.message : "网络错误";
	} finally {
		imgbedTesting = false;
	}
}

function appendPhoto(url: string, type?: string) {
	if (!url) return;
	const line = type ? `${url} ${type}` : url;
	photosText = photosText.trim()
		? `${photosText.replace(/\s+$/, "")}\n${line}`
		: line;
	photos = parsePhotosText(photosText);
}

function openUpload() {
	uploadQueue = [];
	uploadOpen = true;
}

function closeUpload() {
	if (uploading) return;
	uploadOpen = false;
	uploadQueue = [];
}

function onPickFiles(e: Event) {
	const input = e.currentTarget as HTMLInputElement;
	const files = Array.from(input.files ?? []);
	input.value = "";
	if (!files.length) return;
	for (const file of files) {
		uploadQueue.push({
			id: ++uploadIdSeq,
			file,
			status: "pending",
			progress: 0,
			error: "",
		});
	}
	if (!uploading) void runUploadQueue();
}

function uploadOne(item: UploadItem): Promise<{ url: string; type?: string }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const fd = new FormData();
		fd.append("file", item.file);
		xhr.open("POST", `/api/gallery/${encodeURIComponent(slug)}/photos/`);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable)
				item.progress = Math.round((e.loaded / e.total) * 100);
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const data = JSON.parse(xhr.responseText) as {
						url?: string;
						type?: string;
					};
					if (!data.url) {
						reject(new Error("上传响应缺少 url"));
						return;
					}
					resolve({ url: data.url, type: data.type });
				} catch {
					reject(new Error("上传响应解析失败"));
				}
			} else {
				let msg = `上传失败（HTTP ${xhr.status}）`;
				try {
					const data = JSON.parse(xhr.responseText) as { error?: string };
					if (data?.error) msg = data.error;
				} catch {
					// 非 JSON 响应体，保留 HTTP 状态提示
				}
				reject(new Error(msg));
			}
		};
		xhr.onerror = () => reject(new Error("网络错误"));
		xhr.send(fd);
	});
}

async function runUploadQueue() {
	uploading = true;
	try {
		for (const item of uploadQueue) {
			if (item.status !== "pending") continue;
			item.status = "uploading";
			item.progress = 0;
			try {
				const res = await uploadOne(item);
				item.status = "done";
				appendPhoto(res.url, res.type);
				await save();
			} catch (err) {
				item.status = "error";
				item.error = err instanceof Error ? err.message : "网络错误";
			}
		}
	} finally {
		uploading = false;
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
				<a href="/admin/gallery/">← 返回相册列表</a>{#if message} · {message}{/if}
			</p>
		</div>
		<div class="ui-acts">
			{#if !isNew}
				<button class="ui-btn" onclick={removeAlbum} disabled={saving}>删除相册</button>
			{/if}
			<button class="ui-btn ui-btn-primary" onclick={save} disabled={saving}>
				{saving ? "保存中…" : isNew ? "创建" : "保存"}
			</button>
		</div>
	</div>

	{#if loaded}

			<section class="ui-card">
				<div class="ui-card-h">相册信息<span class="ui-sub">名称与访问路径必填</span></div>
				<div class="ui-card-b">
					<div class="stack-fields">
						<div class="ui-grid">
							<label class="ui-field">
								<span class="ui-label">名称</span>
								<input class="ui-input" type="text" bind:value={formTitle} placeholder="相册标题" autocomplete="off" />
							</label>
							<label class="ui-field">
								<span class="ui-label">封面备注</span>
								<input class="ui-input" type="text" bind:value={formCover} placeholder="封面图片地址（可选）" autocomplete="off" />
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
							<label class="ui-field">
								<span class="ui-label">访问路径（slug）</span>
								{#if isNew}
									<input class="ui-input" type="text" bind:value={newSlug} placeholder="english-slug" autocomplete="off" />
								{:else}
									<input class="ui-input" type="text" value={slug} disabled />
								{/if}
							</label>
							<label class="ui-field" style="grid-column:1/-1">
								<span class="ui-label">描述</span>
								<textarea class="ui-input area" rows="3" bind:value={formDesc} placeholder="相册描述（可选）"></textarea>
							</label>
							<label class="check-line" style="grid-column:1/-1">
								<Switch on={hadEncrypted} label="加密相册" toggle={() => (hadEncrypted = !hadEncrypted)} />
								<span class="check-text">加密相册</span>
							</label>
						</div>
					</div>
				</div>
			</section>

		<section class="ui-card">
			<div class="ui-card-h">
				图床 API
				{#if imgbedEnabled}
					<span class="ui-badge">已启用</span>
				{:else if imgbedEndpoint && imgbedToken}
					<span class="ui-badge">已配置</span>
				{:else}
					<span class="ui-badge ui-badge-warn">未配置</span>
				{/if}
			</div>
			<div class="ui-card-b">
				<div class="ui-grid imgbed-grid">
					<label class="ui-field">
						<span class="ui-label">API 端点</span>
						<input class="ui-input" type="text" bind:value={imgbedEndpoint} placeholder="https://…" autocomplete="off" />
					</label>
					<label class="ui-field">
						<span class="ui-label">密钥 Token</span>
						<input class="ui-input" type="password" bind:value={imgbedToken} autocomplete="new-password" />
					</label>
					<label class="ui-field">
						<span class="ui-label">目录</span>
						<input class="ui-input" type="text" bind:value={imgbedDir} placeholder="album" autocomplete="off" />
					</label>
				</div>
				<div class="row-flex">
					<button class="ui-btn" onclick={testImgbed} disabled={imgbedTesting}>
						{imgbedTesting ? "测试中…" : "测试连接"}
					</button>
					<button class="ui-btn ui-btn-primary" onclick={saveImgbed} disabled={imgbedSaving}>
						{imgbedSaving ? "保存中…" : "保存并启用"}
					</button>
					{#if imgbedEnabled}
						<button class="ui-btn ui-btn-ghost" onclick={disableImgbed} disabled={imgbedSaving}>禁用</button>
					{/if}
				</div>
				{#if imgbedMsg}
					<p class="ui-sub">{imgbedMsg}</p>
				{/if}
				{#if imgbedTestMsg}
					<p class="ui-sub">{imgbedTestMsg}</p>
				{/if}
			</div>
		</section>
		<section class="ui-card">
					<div class="ui-card-h card-h-up">
						照片
						<span class="ui-sub">点击可预览</span>
						<button
							class="ui-btn ui-btn-sm ui-btn-primary up-btn"
							onclick={openUpload}
							disabled={isNew}
							title={isNew ? "先保存相册再上传" : "上传到 R2"}
						>上传</button>
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
								图床 API 未启用，可在上方「图床 API」卡配置端点与密钥并启用。
							</p>
						{/if}
						{#if imgbedMsg}
							<p class="ui-sub">{imgbedMsg}</p>
						{/if}
					</div>
				</section>
		<section class="ui-card">
					<div class="ui-card-h">访问密码</div>
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
						{#if passwordMsg}
							<p class="ui-sub">{passwordMsg}</p>
						{/if}
					</div>
				</section>
	{:else}
		<div class="ui-card"><div class="ui-empty">{message || "加载中…"}</div></div>
	{/if}
</div>

{#if uploadOpen}
	<div class="modal-mask" role="presentation">
		<div class="modal-panel" role="dialog" aria-modal="true" aria-label="上传到 R2">
			<div class="modal-head">
				<span>上传到 R2{#if uploadQueue.length} · {uploadQueue.length} 个文件{/if}</span>
				<button class="ui-btn ui-btn-sm" onclick={closeUpload} disabled={uploading}>关闭</button>
			</div>
			<div class="modal-body">
				{#each uploadQueue as item (item.id)}
					<div class="up-row">
						<div class="up-thumb"></div>
						<div class="up-main">
							<span class="up-name">{item.file.name}</span>
							{#if item.status === "uploading"}
								<div class="up-bar"><div class="up-bar-fill" style={`width:${item.progress}%`}></div></div>
							{:else if item.status === "done"}
								<span class="ui-badge">已完成</span>
							{:else if item.status === "error"}
								<span class="ui-badge ui-badge-warn up-err">{item.error}</span>
							{:else}
								<span class="ui-sub">等待上传</span>
							{/if}
						</div>
					</div>
				{/each}
				{#if !uploadQueue.length}
					<div class="ui-empty">尚未选择文件</div>
				{/if}
			</div>
			<div class="modal-foot">
				<button class="ui-btn" onclick={() => fileInput?.click()} disabled={uploading}>继续添加</button>
				<button class="ui-btn ui-btn-primary" onclick={closeUpload} disabled={uploading}>完成</button>
			</div>
		</div>
	</div>
{/if}

{#if uploading && uploadBig}
	<div class="up-fixed" role="status">
		<span class="up-fixed-text">{uploadDone}/{uploadQueue.length} · {uploadCurrent}</span>
		<div class="up-bar"><div class="up-bar-fill" style={`width:${uploadPercent}%`}></div></div>
	</div>
{/if}

<input class="hidden-input" type="file" multiple accept="image/*,video/*" bind:this={fileInput} onchange={onPickFiles} />

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
	.imgbed-grid {
		margin-bottom: 12px;
	}
	.card-h-up .ui-sub {
		margin-left: 0;
	}
	.card-h-up .up-btn {
		margin-left: auto;
	}
	.modal-mask {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: color-mix(in srgb, var(--deep-text) 45%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.modal-panel {
		width: min(520px, 100%);
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		background: var(--card-bg);
		border: 1px solid var(--line-color);
		border-radius: 12px;
		overflow: hidden;
	}
	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--line-color);
		font-size: 13px;
		font-weight: 600;
		color: var(--deep-text);
	}
	.modal-body {
		padding: 12px 16px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.modal-foot {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid var(--line-color);
	}
	.up-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.up-thumb {
		width: 40px;
		height: 40px;
		flex: none;
		border: 1px solid var(--line-color);
		border-radius: 8px;
		background: var(--page-bg);
	}
	.up-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.up-name {
		font-size: 12.5px;
		color: var(--deep-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	.up-bar {
		width: 100%;
		height: 6px;
		border: 1px solid var(--line-color);
		border-radius: 999px;
		background: var(--page-bg);
		overflow: hidden;
	}
	.up-bar-fill {
		height: 100%;
		background: var(--primary-fill);
	}
	.up-err {
		white-space: normal;
		text-align: left;
	}
	.up-fixed {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 80;
		width: min(360px, calc(100vw - 32px));
		background: var(--card-bg);
		border: 1px solid var(--line-color);
		border-radius: 12px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.up-fixed-text {
		font-size: 12px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.hidden-input {
		display: none;
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