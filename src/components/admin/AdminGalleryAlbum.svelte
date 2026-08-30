<script lang="ts">
import { onMount, tick } from "svelte";
import Vditor from "vditor";
import "vditor/dist/index.css";

export let slug = "";

let editor: Vditor | null = null;
let rawSource = "";
let loaded = false;
let saving = false;
let message = "";

// 相册密码管理（存 D1，动态博客方式，不写进 frontmatter）
let hasPassword = false;
let passwordInput = "";
let passwordMsg = "";
let passwordSaving = false;

async function loadPasswordState() {
	try {
		const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/password/`);
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
		const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/password/`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: passwordInput }),
		});
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
		const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/password/`, {
			method: "DELETE",
		});
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
	try {
		const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/`);
		if (resp.ok) {
			const data = await resp.json();
			rawSource = data.source ?? "";
		}
		loaded = true;
		await tick();
		initEditor();
	} catch {
		message = "加载失败";
		loaded = true;
	}
	loadPasswordState();
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
	try {
		const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/`, {
			method: "PUT",
			headers: { "Content-Type": "text/markdown" },
			body: content,
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "保存失败";
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
		<h2>相册：{slug}</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
			<a class="btn" href="/admin/gallery/">返回相册列表</a>
		</div>
	</div>
	<p class="hint">
		编辑 gallery/{slug}/index.md。frontmatter 支持 title/desc/date/location/tags/encrypted/photos（URL 列表）/source
		（webdav 时需配置 webdav.url 与 username）。
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
		</div>
		{#if passwordMsg}
			<span class="password-msg">{passwordMsg}</span>
		{/if}
	</div>

	{#if loaded}
		<div id="vditor-editor"></div>
	{:else}
		<p>{message || "加载中…"}</p>
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
		flex: 1;
		min-width: 200px;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg, #fff);
		color: var(--deep-text, #374151);
	}
	.password-msg {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.82rem;
		color: #16a34a;
	}
</style>
