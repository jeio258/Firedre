<script lang="ts">
import { onMount, tick } from "svelte";
import Vditor from "vditor";
import "vditor/dist/index.css";

export let slug = "";
export let isNew = false;

let editor: Vditor | null = null;
let rawSource = "";
let loaded = false;
let saving = false;
let message = "";
// 创建模式：相册 slug 由用户在创建页填写，保存时必填
let newSlug = "";

// 相册密码管理（存 D1，动态博客方式，不写进 frontmatter）
let hasPassword = false;
let passwordInput = "";
let passwordMsg = "";
let passwordSaving = false;

// 图床 API 源（方案①）：全局配置端点+密钥（站点设置 → 相册），图床目录（?dir=）由用户填写存全局，留空=根目录
let imgbedEndpoint = "";
let imgbedEnabled = false;
let imgbedDir = "";
let imgbedDirSaving = false;
let imgbedDirMsg = "";
let imgbedMsg = "";
let imgbedFetching = false;

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
		// 忽略：读取失败不影响正文编辑
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
	try {
		const resp = await fetch(
			`/api/gallery/${encodeURIComponent(slug)}/imgbed/photos/`,
			{ method: "POST" },
		);
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			imgbedMsg = data.message || "图床拉取失败";
			return;
		}
		imgbedMsg = `已从图床获取 ${data.count} 张图片 ✓（已写入 photos，请点保存以持久化）`;
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
		// 忽略：无法读取密码状态不影响正文编辑
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
			{
				method: "DELETE",
			},
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
	// 创建模式：无 slug 不拉取已有相册，直接初始化空编辑器
	if (!isNew) {
		try {
			const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/`);
			if (resp.ok) {
				const data = await resp.json();
				rawSource = data.source ?? "";
			}
		} catch {
			message = "加载失败";
		}
	}
	loaded = true;
	await tick();
	initEditor();
	loadPasswordState();
	loadImgbedStatus();
}

function initEditor() {
	if (editor) {
		editor.setValue(rawSource);
		return;
	}
	editor = new Vditor("vditor-editor", {
		cdn: "/vditor",
		height: 520,
		mode: "ir",
		value: rawSource,
		cache: { enable: false },
		after: () => {
			// 初始化完成
		},
	});
}

async function save() {
	saving = true;
	message = "";
	const content = editor ? editor.getValue() : rawSource;
	if (!content.trim()) {
		message = "内容不能为空";
		saving = false;
		return;
	}
	// 创建模式：相册 slug 必填，未填则阻止保存
	let targetSlug = slug;
	if (isNew) {
		targetSlug = newSlug.trim();
		if (!targetSlug) {
			message = "请填写相册 slug";
			saving = false;
			return;
		}
	}
	try {
		const resp = await fetch(`/api/gallery/${encodeURIComponent(targetSlug)}/`, {
			method: "PUT",
			headers: { "Content-Type": "text/markdown" },
			body: content,
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "保存失败";
			return;
		}
		// 创建模式保存成功后跳转到该相册的真实编辑页
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
					class="slug-input"
					type="text"
					bind:value={newSlug}
					placeholder="相册 slug（必填，保存时校验）"
					autocomplete="off"
					title="相册 slug，保存时必填"
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
	<p class="hint">
		{isNew
			? "填写相册 slug 与内容后点击「创建」，保存时 slug 必填。"
			: `编辑 gallery/${slug}/index.md。frontmatter 支持 title/desc/date/location/tags/encrypted/photos（URL 列表）。图片可用下方「图床 API」从图床拉取公开直链后写入 photos。`}
	</p>

	<div class="password-box">
		<span class="password-label">相册访问密码（存 D1，不写入文件）</span>
		<div class="password-row">
			<input
				class="password-input"
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
				class="dir-input"
				type="text"
				bind:value={imgbedDir}
				placeholder="图床目录 ?dir=（留空=根目录）"
				autocomplete="off"
				title="图床目录（?dir=），存全局配置；留空 = 从根目录拉取"
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

	{#if loaded}
		<div id="vditor-editor"></div>
	{:else}
		<p>{message || "加载中…"}</p>
	{/if}
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0;
		color: var(--deep-text, inherit);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.msg {
		color: #16a34a;
		font-size: 0.85rem;
	}
	.btn {
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		text-decoration: none;
		font-size: 0.9rem;
		color: var(--deep-text, #374151);
		background: var(--card-bg, #fff);
	}
	.btn-primary {
		padding: 0.5rem 0.9rem;
		background: var(--primary, #5b8cff);
		color: #fff;
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.btn-danger {
		padding: 0.5rem 0.9rem;
		background: #dc2626;
		color: #fff;
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.hint {
		color: var(--muted, #6b7280);
		font-size: 0.82rem;
		margin: 0 0 1rem;
	}
	.password-box {
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		border: 1px dashed var(--line-divider, #d1d5db);
		border-radius: var(--radius-large, 0.75rem);
	}
	.password-label {
		display: block;
		font-size: 0.85rem;
		color: var(--muted, #6b7280);
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
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg, #fff);
		color: var(--deep-text, #374151);
	}
	.slug-input {
		flex: 0 0 auto;
		width: 220px;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg, #fff);
		color: var(--deep-text, #374151);
	}
	.dir-input {
		flex: 0 0 auto;
		width: 220px;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg, #fff);
		color: var(--deep-text, #374151);
	}
	.dir-divider {
		width: 1px;
		height: 1.4rem;
		background: var(--line-divider, #e5e7eb);
		margin: 0 0.2rem;
	}
	.imgbed-info {
		color: var(--muted, #6b7280);
		font-size: 0.85rem;
	}
	.link {
		color: var(--primary, #5b8cff);
		text-decoration: underline;
	}
	.password-msg {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.82rem;
		color: #16a34a;
	}
</style>
