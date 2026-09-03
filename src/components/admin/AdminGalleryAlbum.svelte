<script lang="ts">
	import { onMount } from "svelte";
	import { parseAlbumSource, serializeAlbumMarkdown } from "../../../server/gallery/frontmatter";

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
	let photos: Array<{ url: string; type?: string; poster?: string; date?: string }> = $state([]);

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
			// 忽略
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
				imgbedDirMsg = "已保存图床目录（留空 = 根目录）";
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
			imgbedMsg = `已从图床获取 ${data.count} 张图片`;
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
			passwordMsg = hasPassword ? "已设置相册密码" : "已清除相册密码";
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
			passwordMsg = "已清除相册密码";
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
			message = "已保存";
		} catch {
			message = "网络错误";
		} finally {
			saving = false;
		}
	}

	onMount(load);
</script>

<div class="crud-page">
	<div class="crud-head">
		<div>
			<h2>{isNew ? "创建相册" : `相册：${slug}`}</h2>
			<p class="crud-sub">元数据 + 照片列表 + 密码 + 图床</p>
		</div>
		<div class="crud-head-actions">
			{#if isNew}
				<input class="slug-input" type="text" bind:value={newSlug} placeholder="相册 slug（必填）" autocomplete="off" />
			{/if}
			{#if message}
				<span class="crud-msg">{message}</span>
			{/if}
			<a class="btn-ghost" href="/admin/gallery/">返回相册列表</a>
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : isNew ? "创建" : "保存"}
			</button>
		</div>
	</div>

	{#if loaded}
		<div class="crud-card">
			<div class="form-grid">
				<label class="crud-field">
					<span>标题</span>
					<input class="ctrl" type="text" bind:value={formTitle} placeholder="相册标题" autocomplete="off" />
				</label>
				<label class="crud-field">
					<span>日期</span>
					<input class="ctrl" type="text" bind:value={formDate} placeholder="如 2026-08-31" autocomplete="off" />
				</label>
				<label class="crud-field">
					<span>地点</span>
					<input class="ctrl" type="text" bind:value={formLocation} placeholder="如 杭州市" autocomplete="off" />
				</label>
				<label class="crud-field">
					<span>封面 URL</span>
					<input class="ctrl" type="text" bind:value={formCover} placeholder="封面图片地址（可选）" autocomplete="off" />
				</label>
				<label class="crud-field full">
					<span>标签（逗号分隔）</span>
					<input class="ctrl" type="text" bind:value={formTags} placeholder="如 旅行, 风景" autocomplete="off" />
				</label>
				<label class="crud-field full">
					<span>描述</span>
					<textarea class="ctrl" rows="4" bind:value={formDesc} placeholder="相册描述（可选）"></textarea>
				</label>
			</div>
		</div>

		<div class="crud-card">
			<label class="crud-field full">
				<span>照片列表（每行一个 URL，可选 type）</span>
				<textarea class="ctrl mono" rows="6" bind:value={photosText} placeholder={"https://…/1.jpg\nhttps://…/2.jpg video"}></textarea>
			</label>
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

		<div class="crud-card">
			<label class="crud-field full">
				<span>相册访问密码（存 D1，不写入文件）</span>
				<div class="row-flex">
					<input class="ctrl" type="password" bind:value={passwordInput} placeholder={hasPassword ? "已设置密码，输入新密码可修改" : "设置访问密码"} autocomplete="off" />
					<button class="btn-primary" on:click={savePassword} disabled={passwordSaving}>
						{passwordSaving ? "保存中…" : "保存密码"}
					</button>
					{#if hasPassword}
						<button class="btn-ghost" on:click={clearPassword} disabled={passwordSaving}>清除密码</button>
					{/if}
				</div>
			</label>
			<label class="crud-field full">
				<span>图床目录 ?dir=（留空=根目录）</span>
				<div class="row-flex">
					<input class="ctrl" type="text" bind:value={imgbedDir} placeholder="图床目录 ?dir=" autocomplete="off" />
					<button class="btn-primary" on:click={saveImgbedDir} disabled={imgbedDirSaving}>
						{imgbedDirSaving ? "保存中…" : "保存目录"}
					</button>
				</div>
			</label>
			{#if passwordMsg}
				<p class="hint-msg">{passwordMsg}</p>
			{/if}
			{#if imgbedDirMsg}
				<p class="hint-msg">{imgbedDirMsg}</p>
			{/if}
		</div>

		<div class="crud-card">
			<label class="crud-field full">
				<span>图床 API（方案①：全局配置端点+密钥，目录用上方 ?dir=）</span>
				<div class="row-flex">
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
			</label>
			{#if imgbedMsg}
				<p class="hint-msg">{imgbedMsg}</p>
			{/if}
		</div>
	{:else}
		<div class="crud-empty">{message || "加载中…"}</div>
	{/if}
</div>

<style>
	.slug-input {
		padding: 0.46rem 0.65rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--deep-text);
		font-size: 0.88rem;
		width: 220px;
	}
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.9rem 1rem;
	}
	.crud-field.full {
		grid-column: 1 / -1;
	}
	.ctrl {
		padding: 0.48rem 0.65rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--deep-text);
		font-size: 0.88rem;
		width: 100%;
		box-sizing: border-box;
		font-family: inherit;
	}
	.ctrl.mono {
		font-family: ui-monospace, monospace;
	}
	textarea.ctrl {
		min-height: 64px;
		resize: vertical;
	}
	.row-flex {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
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
		border-radius: 0.4rem;
		overflow: hidden;
		background: var(--btn-regular-bg);
		border: 1px solid var(--line-divider);
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
	.hint-msg {
		margin: 0.4rem 0 0;
		font-size: 0.82rem;
		color: var(--success);
	}
	.imgbed-info {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.link {
		color: var(--primary);
		text-decoration: underline;
	}
	@media (max-width: 767px) {
		.form-grid {
			grid-template-columns: 1fr;
		}
		.slug-input {
			width: 100%;
		}
		.row-flex {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>