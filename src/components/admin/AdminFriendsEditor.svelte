<script lang="ts">
	import { onMount } from "svelte";
	import { apiJson } from "@/lib/adminApi";

	type FriendItem = {
		id: number;
		title: string;
		imgurl: string;
		desc: string;
		siteurl: string;
		tags: string[];
		weight: number;
		enabled: boolean;
	};

	let items: FriendItem[] = [];
	let loading = true;
	let saving = false;
	let message = "";
	let error = "";

	// 表单状态
	let editingId: number | null = null;
	let formTitle = "";
	let formImgurl = "";
	let formDesc = "";
	let formSiteurl = "";
	let formTags = "";
	let formWeight = 0;
	let formEnabled = true;
	let showForm = false;

	async function load() {
		loading = true;
		error = "";
		try {
			const data = await apiJson<{ items?: unknown[] }>("/api/friends/");
			items = Array.isArray(data.items) ? (data.items as FriendItem[]) : [];
		} catch {
			error = "网络错误";
		}
		loading = false;
	}

	function openCreate() {
		editingId = null;
		formTitle = "";
		formImgurl = "";
		formDesc = "";
		formSiteurl = "";
		formTags = "";
		formWeight = 0;
		formEnabled = true;
		showForm = true;
		message = "";
	}

	function openEdit(item: FriendItem) {
		editingId = item.id;
		formTitle = item.title;
		formImgurl = item.imgurl;
		formDesc = item.desc;
		formSiteurl = item.siteurl;
		formTags = (item.tags || []).join(",");
		formWeight = item.weight;
		formEnabled = item.enabled;
		showForm = true;
		message = "";
	}

	function cancelForm() {
		showForm = false;
		editingId = null;
		message = "";
	}

	async function submit() {
		if (!formTitle.trim()) {
			message = "友链名称不能为空";
			return;
		}
		if (!formImgurl.trim()) {
			message = "友链头像地址不能为空";
			return;
		}
		if (!formSiteurl.trim()) {
			message = "友链地址不能为空";
			return;
		}
		saving = true;
		message = "";
		try {
			const payload = {
				title: formTitle.trim(),
				imgurl: formImgurl.trim(),
				desc: formDesc.trim(),
				siteurl: formSiteurl.trim(),
				tags: formTags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
				weight: Number(formWeight) || 0,
				enabled: formEnabled,
			};
			const url = editingId
				? `/api/friends/${editingId}/`
				: "/api/friends/";
			const resp = await fetch(url, {
				method: editingId ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await resp.json();
			if (!resp.ok || !data.ok) {
				message = data.message || "保存失败";
				return;
			}
			message = "已保存 ✓";
			showForm = false;
			editingId = null;
			await load();
		} catch {
			message = "网络错误";
		} finally {
			saving = false;
		}
	}

	async function remove(item: FriendItem) {
		if (!window.confirm(`确定删除友链「${item.title}」吗？`)) return;
		try {
			const resp = await fetch(`/api/friends/${item.id}/`, {
				method: "DELETE",
			});
			const data = await resp.json();
			if (!resp.ok || !data.ok) {
				message = data.message || "删除失败";
				return;
			}
			if (editingId === item.id) cancelForm();
			message = "已删除 ✓";
			await load();
		} catch {
			message = "网络错误";
		}
	}

	onMount(load);
</script>

<div class="admin-card">
	<div class="toolbar">
		<h2>友链管理</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			{#if !showForm}
				<button class="btn-primary" on:click={openCreate}>+ 添加友链</button>
			{/if}
		</div>
	</div>

	{#if error}
		<p class="hint">{error}</p>
	{:else if loading}
		<p class="hint">加载中…</p>
	{:else if showForm}
		<div class="form">
			<div class="form-head">
				<h3>{editingId ? "编辑友链" : "添加友链"}</h3>
				<button class="danger" on:click={cancelForm}>取消</button>
			</div>
			<label class="field">
				<span>名称 *</span>
				<input type="text" placeholder="友链名称" bind:value={formTitle} />
			</label>
			<label class="field">
				<span>头像地址 *</span>
				<input
					type="text"
					placeholder="https://example.com/avatar.png"
					bind:value={formImgurl}
				/>
			</label>
			<label class="field">
				<span>友链地址 *</span>
				<input
					type="text"
					placeholder="https://example.com"
					bind:value={formSiteurl}
				/>
			</label>
			<label class="field">
				<span>描述</span>
				<input type="text" placeholder="一句介绍" bind:value={formDesc} />
			</label>
			<label class="field">
				<span>标签（逗号分隔）</span>
				<input type="text" placeholder="如：Blog, 技术" bind:value={formTags} />
			</label>
			<label class="field">
				<span>排序权重</span>
				<input type="number" min="0" bind:value={formWeight} />
			</label>
			<label class="field check">
				<input type="checkbox" bind:checked={formEnabled} />
				<span>启用（显示在友链页）</span>
			</label>
			<div class="form-actions">
				<button class="btn-primary" on:click={submit} disabled={saving}>
					{saving ? "保存中…" : "保存"}
				</button>
			</div>
		</div>
	{:else if items.length === 0}
		<p class="hint">暂无友链，点击"添加友链"创建第一条。</p>
	{:else}
		<ul class="list">
			{#each items as item}
				<li class="row">
					<div class="row-main">
						<div class="friend-info">
							<img src={item.imgurl} alt={item.title} class="avatar" />
							<div class="friend-text">
								<div class="friend-name">
									{item.title}
									{#if !item.enabled}
										<span class="badge muted">未启用</span>
									{/if}
								</div>
								<div class="friend-desc">{item.desc || "无描述"}</div>
								<div class="friend-url">{item.siteurl}</div>
								{#if item.tags && item.tags.length > 0}
									<div class="friend-tags">
										{#each item.tags as tag}
											<span class="tag">{tag}</span>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
					<div class="row-actions">
						<button class="btn-ghost" on:click={() => openEdit(item)}>编辑</button>
						<button class="danger" on:click={() => remove(item)}>删除</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.hint {
		color: var(--muted, #6b7280);
		font-size: 0.85rem;
	}
	.btn-ghost {
		padding: 0.4rem 0.7rem;
		background: transparent;
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.35rem;
		cursor: pointer;
		color: var(--deep-text, inherit);
	}
	.danger {
		padding: 0.4rem 0.7rem;
		background: transparent;
		border: 1px solid #ef4444;
		color: #ef4444;
		border-radius: 0.35rem;
		cursor: pointer;
	}
	.danger:hover {
		background: #ef4444;
		color: #fff;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1rem 0;
	}
	.form-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	.form-head h3 {
		margin: 0;
		font-size: 1rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: var(--muted, #6b7280);
	}
	.field input[type="text"],
	.field input[type="number"] {
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.35rem;
		background: transparent;
		color: var(--deep-text, inherit);
		font-size: 0.9rem;
	}
	.field.check {
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
	}
	.form-actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.8rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.5rem;
	}
	.row-main {
		min-width: 0;
	}
	.friend-info {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.avatar {
		width: 48px;
		height: 48px;
		border-radius: 0.5rem;
		object-fit: cover;
		flex-shrink: 0;
	}
	.friend-text {
		min-width: 0;
	}
	.friend-name {
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.friend-desc {
		font-size: 0.85rem;
		color: var(--muted, #6b7280);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 420px;
	}
	.friend-url {
		font-size: 0.75rem;
		color: var(--primary, #5b8cff);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 420px;
	}
	.friend-tags {
		display: flex;
		gap: 0.3rem;
		margin-top: 0.3rem;
		flex-wrap: wrap;
	}
	.tag {
		font-size: 0.7rem;
		padding: 0.1rem 0.5rem;
		background: var(--muted, #6b7280);
		background: rgba(128, 128, 128, 0.15);
		border-radius: 0.3rem;
		color: var(--muted, #6b7280);
	}
	.badge {
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border-radius: 0.3rem;
		background: #16a34a;
		color: #fff;
	}
	.badge.muted {
		background: rgba(128, 128, 128, 0.25);
		color: var(--muted, #6b7280);
	}
	.row-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}
</style>
