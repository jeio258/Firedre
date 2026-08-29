<script lang="ts">
import { onMount } from "svelte";

type HtmlFile = {
	slug: string;
	title: string;
	description: string;
	publicPath: string;
	updatedAt: string;
};

let files: HtmlFile[] = [];
let loading = true;
let message = "";

// 编辑态
let editing = false;
let editSlug = "";
let editTitle = "";
let editDescription = "";
let editContent = "";

async function load() {
	try {
		const resp = await fetch("/api/html-files/");
		if (resp.ok) {
			const data = await resp.json();
			files = data.files || [];
		}
	} catch {
		message = "加载失败";
	}
	loading = false;
}

async function openEdit(file?: HtmlFile) {
	if (!file) {
		editing = true;
		editSlug = "";
		editTitle = "";
		editDescription = "";
		editContent =
			'<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title></title></head>\n<body>\n\n</body>\n</html>';
		return;
	}
	try {
		const resp = await fetch(
			`/api/html-files/${encodeURIComponent(file.slug)}/`,
		);
		if (!resp.ok) {
			alert("加载失败");
			return;
		}
		const data = await resp.json();
		editing = true;
		editSlug = file.slug;
		editTitle = data.title || "";
		editDescription = data.description || "";
		editContent = data.content || "";
	} catch {
		alert("网络错误");
	}
}

async function save() {
	if (!editSlug.trim() || !editTitle.trim() || !editContent.trim()) {
		alert("文件名、标题与内容不能为空");
		return;
	}
	try {
		const resp = await fetch(
			`/api/html-files/${encodeURIComponent(editSlug)}/`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					slug: editSlug,
					title: editTitle,
					description: editDescription,
					content: editContent,
				}),
			},
		);
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			alert(data.message || "保存失败");
			return;
		}
		editing = false;
		await load();
		alert("已保存 ✓");
	} catch {
		alert("网络错误");
	}
}

async function remove(slug: string) {
	if (!confirm(`确定删除文件「${slug}.html」？`)) return;
	try {
		const resp = await fetch(`/api/html-files/${encodeURIComponent(slug)}/`, {
			method: "DELETE",
		});
		if (resp.ok) {
			files = files.filter((f) => f.slug !== slug);
		} else {
			alert("删除失败");
		}
	} catch {
		alert("网络错误");
	}
}

onMount(load);
</script>

<div class="admin-card">
	<div class="toolbar">
		<h2>HTML 文件管理</h2>
		{#if !editing}
			<button class="btn-primary" on:click={() => openEdit()}>+ 新建文件</button>
		{/if}
	</div>

	{#if editing}
		<div class="editor">
			<div class="form-row">
				<label>
					<span>文件名（不含 .html）</span>
					<input type="text" bind:value={editSlug} placeholder="custom-page" />
				</label>
				<label>
					<span>标题</span>
					<input type="text" bind:value={editTitle} />
				</label>
			</div>
			<label>
				<span>描述</span>
				<input type="text" bind:value={editDescription} />
			</label>
			<label>
				<span>HTML 内容</span>
				<textarea rows="14" bind:value={editContent} class="code"></textarea>
			</label>
			<div class="editor-ops">
				<button class="btn-primary" on:click={save}>保存</button>
				<button class="btn" on:click={() => (editing = false)}>取消</button>
			</div>
		</div>
	{:else if loading}
		<p class="hint">加载中…</p>
	{:else if files.length === 0}
		<p class="hint">暂无文件</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>文件名</th>
					<th>标题</th>
					<th>访问地址</th>
					<th>操作</th>
				</tr>
			</thead>
			<tbody>
				{#each files as file}
					<tr>
						<td class="mono">{file.slug}.html</td>
						<td>{file.title}</td>
						<td>
							<a href={file.publicPath} target="_blank">{file.publicPath}</a>
						</td>
						<td class="ops">
							<button class="link" on:click={() => openEdit(file)}>编辑</button>
							<button class="danger" on:click={() => remove(file.slug)}>删除</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.admin-card {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		padding: 1.25rem;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0;
	}
	.btn-primary {
		padding: 0.5rem 0.9rem;
		background: var(--primary, #5b8cff);
		color: #fff;
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.btn {
		padding: 0.5rem 0.9rem;
		border: 1px solid #d1d5db;
		border-radius: 0.4rem;
		background: #fff;
		cursor: pointer;
	}
	.editor {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.8rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: #555;
	}
	input,
	textarea {
		padding: 0.5rem 0.7rem;
		border: 1px solid #d1d5db;
		border-radius: 0.4rem;
		font-size: 0.9rem;
	}
	textarea.code {
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
		line-height: 1.5;
	}
	.editor-ops {
		display: flex;
		gap: 0.6rem;
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
		border-bottom: 1px solid #f3f4f6;
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.82rem;
	}
	.ops {
		display: flex;
		gap: 0.6rem;
	}
	.link {
		background: none;
		border: none;
		color: var(--primary, #5b8cff);
		cursor: pointer;
		padding: 0;
	}
	.danger {
		background: none;
		border: none;
		color: #dc2626;
		cursor: pointer;
		padding: 0;
	}
	.hint {
		color: #6b7280;
		padding: 1rem 0;
	}
</style>
