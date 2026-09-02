<script lang="ts">
import { onMount } from "svelte";
import { parseAlbumSource, serializeAlbumMarkdown } from "../../../server/gallery/frontmatter";

export let slug = "";

$: isNew = slug === "";

let loaded = false;
let saving = false;
let message = "";

let newSlug = "";

let hadEncrypted = false;

let formTitle = "";
let formDate = "";
let formLocation = "";
let formTags = "";
let formCover = "";
let formDesc = "";

let photosText = "";
let photos: Array<{ url: string; type?: string; poster?: string; date?: string }> = [];

// 相册密码管理（存 D1，动态博客方式，不写进 frontmatter）
let hasPassword = false;
let passwordInput = "";
let passwordMsg = "";
let passwordSaving = false;

let imgbedEnabled = false;
let imgbedEndpoint = "";
let imgbedDir = "";
let imgbedDirSaving = false;
let imgbedDirMsg = "";
let imgbedMsg = "";
let imgbedFetching = false;

// 照片 URL → 解析为结构化项
function parsePhotosText(text: string) {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [url, ...rest] = line.split(/\s+/);
			const meta = rest[0] || "";

			return { url, type: meta === "video" || meta === "image" ? meta : undefined };
		});
}

function photosToText(list: Array<{ url: string; type?: string }>) {
	return list.map((p) => (p.type ? `${p.url} ${p.type}` : p.url)).join("\n");
}

async function loadImgbedStatus() {
	try {
		const resp = await fetch("/api/settings/?group=gallery");
		if (resp.ok) {
			const data = await resp.json();
			imgbedEnabled = data.imgbedEnabled === true;
			imgbedEndpoint = data.imgbedEndpoint ?? "";
			imgbedDir = data.imgbedDir ?? "";
		}
	} catch {
		// 忽略：读取失败不影响表单
	}
}

async function saveImgbedDir() {
	imgbedDirSaving = true;
	imgbedDirMsg = "";
	try {
		const resp = await fetch("/api/settings/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				group: "gallery",
				data: { imgbedDir: imgbedDir.trim() },
			}),
		});
		const data = await resp.json().catch(() => null);
		if (resp.ok && data?.ok) {
			imgbedDirMsg = "已保存图床目录 ✓（留空 = 根目录）";
		} else {
			imgbedDirMsg = data?.message || "保存失败";
		}
	} catch {
		imgbedDirMsg = "网络错误";
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
		const resp = await fetch(
			`/api/gallery/${encodeURIComponent(targetSlug)}/imgbed/photos/`,
			{ method: "POST" },
		);
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			imgbedMsg = data.message || "图床拉取失败";
			return;
		}
		// 拉取成功：刷新相册，把图床返回的 photos 载入表单
		imgbedMsg = `已从图床获取 ${data.count} 张图片 ✓`;
		await load();
	} catch {
		imgbedMsg = "网络错误";
	} finally {
		imgbedFetching = false;
	}
}

async function loadPasswordState() {
	try {
		const resp = await fetch(
			`/api/gallery/${encodeURIComponent(slug)}/password/`,
		);
		if (resp.ok) {
			const data = await resp.json();
			hasPassword = !!data.hasPassword;
		}
	} catch {
		// 忽略
	}
}

async function savePassword() {
	passwordSaving = true;
	passwordMsg = "";
	try {
		const resp = await fetch(
			`/api/gallery/${encodeURIComponent(slug)}/password/`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password: passwordInput }),
			},
		);
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			passwordMsg = data.message || "密码保存失败";
			return;
		}
		hasPassword = !!data.hasPassword;
		passwordInput = "";
		passwordMsg = hasPassword ? "已设置相册密码 ✓" : "已清除相册密码 ✓";
	} catch {
		passwordMsg = "网络错误";
	} finally {
		passwordSaving = false;
	}
}

async function clearPassword() {
	passwordSaving = true;
	passwordMsg = "";
	try {
		const resp = await fetch(
			`/api/gallery/${encodeURIComponent(slug)}/password/`,
			{ method: "DELETE" },
		);
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			passwordMsg = data.message || "密码清除失败";
			return;
		}
		hasPassword = false;
		passwordInput = "";
		passwordMsg = "已清除相册密码 ✓";
	} catch {
		passwordMsg = "网络错误";
	} finally {
		passwordSaving = false;
	}
}

async function load() {
	if (!isNew) {
		try {
			const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/`);
			if (resp.ok) {
				const data = await resp.json();
				const fm = data?.frontmatter || {};
				formTitle = String(fm.title || "");
				formDate = String(fm.date || "");
				formLocation = String(fm.location || "");
				formTags = Array.isArray(fm.tags) ? fm.tags.join(", ") : "";
				formCover = String(fm.cover || "");
				formDesc = String(fm.desc || "");
				hadEncrypted = fm.encrypted === true;
				photos = Array.isArray(fm.photos)
					? (fm.photos as Array<{ url: string; type?: string; poster?: string; date?: string }>).filter((p) => p?.url)
					: [];
				photosText = photosToText(photos);
			} else {
				message = "加载失败";
			}
		} catch {
			message = "网络错误";
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
			return;
		}
	}
	// 组装 frontmatter markdown 走现有 PUT（元数据写 D1）
	const fm = buildFrontmatter() as Parameters<typeof serializeAlbumMarkdown>[0];
	const markdown = serializeAlbumMarkdown(fm, "");
	try {
		const resp = await fetch(`/api/gallery/${encodeURIComponent(targetSlug)}/`, {
			method: "PUT",
			headers: { "Content-Type": "text/markdown" },
			body: markdown,
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "保存失败";
			return;
		}
		if (isNew) {
			window.location.href = `/admin/gallery/${encodeURIComponent(targetSlug)}/`;
			return;
		}
		message = "已保存 ✓";
	} catch {
		message = "网络错误";
	} finally {
		saving = false;
	}
}

onMount(load);
</script>

<div class="admin-card">
	<div class="toolbar">
		<h2>{isNew ? "创建相册" : `相册：${slug}`}</h2>
		<div class="actions">
			{#if isNew}
				<input
					class="field-input slug-input"
					type="text"
					bind:value={newSlug}
					placeholder="相册 slug（必填，保存时校验）"
					autocomplete="off"
				/>
			{/if}
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : isNew ? "创建" : "保存"}
			</button>
			<a class="btn" href="/admin/gallery/">返回相册列表</a>
		</div>
	</div>

	{#if loaded}
		<div class="form-grid">
			<label class="field">
				<span class="field-label">标题</span>
				<input class="field-input" type="text" bind:value={formTitle} placeholder="相册标题" autocomplete="off" />
			</label>
			<label class="field">
				<span class="field-label">日期</span>
				<input class="field-input" type="text" bind:value={formDate} placeholder="如 2026-08-31" autocomplete="off" />
			</label>
			<label class="field">
				<span class="field-label">地点</span>
				<input class="field-input" type="text" bind:value={formLocation} placeholder="如 杭州市" autocomplete="off" />
			</label>
			<label class="field">
				<span class="field-label">封面 URL</span>
				<input class="field-input" type="text" bind:value={formCover} placeholder="封面图片地址（可选）" autocomplete="off" />
			</label>
			<label class="field field-full">
				<span class="field-label">标签（逗号分隔）</span>
				<input class="field-input" type="text" bind:value={formTags} placeholder="如 旅行, 风景" autocomplete="off" />
			</label>
			<label class="field field-full">
				<span class="field-label">描述</span>
				<textarea class="field-input" rows="4" bind:value={formDesc} placeholder="相册描述（可选）"></textarea>
			</label>
		</div>

		<div class="password-box">
			<span class="password-label">照片列表（每行一个 URL，可选 type）</span>
			<textarea class="field-input" rows="6" bind:value={photosText} placeholder={"https://…/1.jpg\nhttps://…/2.jpg video"}></textarea>
			{#if photos.length}
				<div class="thumb-grid">
					{#each photos as p}
						<div class="thumb">
							{#if p.url}
								<img src={p.url} alt="" loading="lazy" referrerpolicy="no-referrer" />
								<span class="thumb-type">{p.type || "img"}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<p>{message || "加载中…"}</p>
	{/if}

	<div class="password-box">
		<span class="password-label">相册访问密码（存 D1，不写入文件）</span>
		<div class="password-row">
			<input
				class="field-input password-input"
				type="password"
				bind:value={passwordInput}
				placeholder={hasPassword ? "已设置密码，输入新密码可修改" : "设置访问密码"}
				autocomplete="off"
			/>
			<button class="btn-primary" on:click={savePassword} disabled={passwordSaving}>
				{passwordSaving ? "保存中…" : "保存密码"}
			</button>
			{#if hasPassword}
				<button class="btn-danger" on:click={clearPassword} disabled={passwordSaving}>清除密码</button>
			{/if}
			<span class="dir-divider"></span>
			<input
				class="field-input dir-input"
				type="text"
				bind:value={imgbedDir}
				placeholder="图床目录 ?dir=（留空=根目录）"
				autocomplete="off"
			/>
			<button class="btn-primary" on:click={saveImgbedDir} disabled={imgbedDirSaving}>
				{imgbedDirSaving ? "保存中…" : "保存目录"}
			</button>
		</div>
		{#if passwordMsg}
			<span class="password-msg">{passwordMsg}</span>
		{/if}
		{#if imgbedDirMsg}
			<span class="password-msg">{imgbedDirMsg}</span>
		{/if}
	</div>

	<div class="password-box">
		<span class="password-label">图床 API（方案①：全局配置端点+密钥，目录用上方 ?dir=）</span>
		<div class="password-row">
			{#if imgbedEnabled}
				<span class="imgbed-info">
					图床：{imgbedEndpoint || "（未设置端点）"} ｜ 目录：{imgbedDir || "（根目录）"}
				</span>
				<button class="btn-primary" on:click={fetchFromImgbed} disabled={imgbedFetching}>
					{imgbedFetching ? "拉取中…" : "从图床获取图片"}
				</button>
			{:else}
				<span class="imgbed-info">图床 API 未启用。请先在<a href="/admin/settings/" class="link">站点设置 → 相册</a>配置「图床 API 端点 + 密钥」并启用。</span>
			{/if}
		</div>
		{#if imgbedMsg}
			<span class="password-msg">{imgbedMsg}</span>
		{/if}
	</div>
</div>

<style>
	.toolbar {
		margin-bottom: 0.5rem;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.msg {
		color: var(--success);
		font-size: 0.85rem;
	}
	.btn {
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--line-color);
		border-radius: 0.4rem;
		text-decoration: none;
		font-size: 0.9rem;
		color: var(--deep-text);
		background: var(--card-bg);
	}
	.btn-danger {
		padding: 0.5rem 0.9rem;
		background: var(--danger);
		color: var(--on-accent);
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.8rem;
		margin-bottom: 1rem;
	}
	.field-full {
		grid-column: 1 / -1;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.field-label {
		font-size: 0.82rem;
		color: var(--muted);
	}
	.field-input {
		width: 100%;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-color);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg);
		color: var(--deep-text);
		box-sizing: border-box;
	}
	textarea.field-input {
		font-family: monospace;
	}
	.slug-input {
		width: 220px;
	}
	.password-box {
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		border: 1px dashed var(--line-divider);
		border-radius: var(--radius-large);
	}
	.password-label {
		display: block;
		font-size: 0.85rem;
		color: var(--muted);
		margin-bottom: 0.5rem;
	}
	.password-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.password-input {
		flex: 0 0 auto;
		width: 220px;
	}
	.dir-input {
		flex: 0 0 auto;
		width: 220px;
	}
	.dir-divider {
		width: 1px;
		height: 1.4rem;
		background: var(--line-divider);
		margin: 0 0.2rem;
	}
	.thumb-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
		gap: 0.4rem;
		margin-top: 0.6rem;
	}
	.thumb {
		position: relative;
		aspect-ratio: 1;
		border-radius: 0.3rem;
		overflow: hidden;
		background: var(--btn-regular-bg);
		border: 1px solid var(--line-color);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.thumb-type {
		position: absolute;
		bottom: 2px;
		right: 2px;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		font-size: 0.6rem;
		padding: 1px 4px;
		border-radius: 3px;
	}
	.imgbed-info {
		color: var(--muted);
		font-size: 0.85rem;
	}
	.link {
		color: var(--primary);
		text-decoration: underline;
	}
	.password-msg {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.82rem;
		color: var(--success);
	}

	@media (max-width: 767px) {
		.form-grid {
			grid-template-columns: 1fr;
		}
		.slug-input,
		.password-input,
		.dir-input {
			width: 100%;
		}
		.password-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
