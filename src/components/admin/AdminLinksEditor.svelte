<script lang="ts">
	import { onMount } from "svelte";
	import type {
		FriendLinkGroup,
		FriendLinkItem,
	} from "../../../types/links";

	export let section = "links";

	let groups: FriendLinkGroup[] = [];
	let loading = true;
	let saving = false;
	let message = "";

	// 编辑态
	let editingGroupIdx: number | null = null;
	let groupName = "";
	let groupDesc = "";
	let editingLink: { groupIdx: number; linkIdx: number } | null = null;
	let linkForm: FriendLinkItem = emptyLink();

	function emptyLink(): FriendLinkItem {
		return { url: "", avatar: "", name: "", desc: "", blog: "", color: "", siteshot: "" };
	}

	async function load() {
		loading = true;
		message = "";
		try {
			const resp = await fetch("/api/links/");
			if (resp.ok) {
				const data = await resp.json();
				groups = Array.isArray(data.linkGroups)
					? data.linkGroups.map((g: FriendLinkGroup) => ({
							name: g.name ?? "",
							desc: g.desc ?? "",
							links: Array.isArray(g.links) ? g.links : [],
						}))
					: [];
			} else {
				message = "加载失败";
			}
		} catch {
			message = "网络错误";
		}
		loading = false;
	}

	async function save() {
		saving = true;
		message = "";
		try {
			const resp = await fetch("/api/links/", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ linkGroups: groups }),
			});
			const data = await resp.json();
			if (!resp.ok || !data.ok) {
				message = data.message || "保存失败";
				return;
			}
			message = "已保存 ✓ " + new Date().toLocaleTimeString();
		} catch {
			message = "网络错误";
		} finally {
			saving = false;
		}
	}

	// ---- 分组操作 ----
	function addGroup() {
		groups = [...groups, { name: "新分组", desc: "", links: [] }];
		editingGroupIdx = groups.length - 1;
		groupName = "新分组";
		groupDesc = "";
		message = "有未保存的修改，请点击「保存」";
	}

	function openGroupEdit(idx: number) {
		editingGroupIdx = idx;
		groupName = groups[idx].name ?? "";
		groupDesc = groups[idx].desc ?? "";
	}

	function saveGroup() {
		if (editingGroupIdx == null) return;
		const next = [...groups];
		next[editingGroupIdx] = {
			...next[editingGroupIdx],
			name: groupName,
			desc: groupDesc,
		};
		groups = next;
		editingGroupIdx = null;
		message = "有未保存的修改，请点击「保存」";
	}

	function removeGroup(idx: number) {
		if (!window.confirm("确认删除该分组及其全部友链？")) return;
		groups = groups.filter((_, i) => i !== idx);
		message = "有未保存的修改，请点击「保存」";
	}

	// ---- 友链操作 ----
	function addLink(groupIdx: number) {
		editingLink = { groupIdx, linkIdx: -1 };
		linkForm = emptyLink();
	}

	function openLinkEdit(groupIdx: number, linkIdx: number) {
		editingLink = { groupIdx, linkIdx };
		linkForm = { ...groups[groupIdx].links[linkIdx] };
	}

	function saveLink() {
		if (!editingLink) return;
		const item = {
			...linkForm,
			url: (linkForm.url || "").trim(),
			avatar: (linkForm.avatar || "").trim(),
			name: (linkForm.name || "").trim(),
			desc: (linkForm.desc || "").trim() || undefined,
			blog: (linkForm.blog || "").trim() || undefined,
			color: (linkForm.color || "").trim() || undefined,
			siteshot: (linkForm.siteshot || "").trim() || undefined,
		};
		if (!item.name || !item.url) {
			message = "名称和链接不能为空";
			return;
		}
		const next = [...groups];
		const g = { ...next[editingLink.groupIdx], links: [...next[editingLink.groupIdx].links] };
		if (editingLink.linkIdx >= 0) {
			g.links[editingLink.linkIdx] = item;
		} else {
			g.links.push(item);
		}
		next[editingLink.groupIdx] = g;
		groups = next;
		editingLink = null;
		message = "有未保存的修改，请点击「保存」";
	}

	function cancelLink() {
		editingLink = null;
	}

	function removeLink(groupIdx: number, linkIdx: number) {
		if (!window.confirm("确认删除该友链？")) return;
		const next = [...groups];
		const g = { ...next[groupIdx], links: next[groupIdx].links.filter((_, i) => i !== linkIdx) };
		next[groupIdx] = g;
		groups = next;
		message = "有未保存的修改，请点击「保存」";
	}

	onMount(load);
</script>

<div class="links-app">
	<div class="toolbar">
		<h2>友链管理</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>
	<p class="hint">以卡片形式管理友链，与前端展示一致。新增/编辑/删除分组与友链后点「保存」生效。</p>

	{#if loading}
		<p class="empty">加载中…</p>
	{:else}
		{#each groups as group, gi}
			<div class="group-card">
				<div class="group-head">
					<div class="group-title">
						<input
							class="group-name"
							value={group.name ?? ""}
							placeholder="分组名称"
							on:input={(e) => {
								const next = [...groups];
								next[gi] = { ...next[gi], name: e.currentTarget.value };
								groups = next;
								message = "有未保存的修改";
							}}
						/>
						<input
							class="group-desc"
							value={group.desc ?? ""}
							placeholder="分组描述（可选）"
							on:input={(e) => {
								const next = [...groups];
								next[gi] = { ...next[gi], desc: e.currentTarget.value };
								groups = next;
								message = "有未保存的修改";
							}}
						/>
					</div>
					<div class="group-actions">
						<button class="btn-ghost danger" on:click={() => removeGroup(gi)}>删除分组</button>
					</div>
				</div>

				<div class="links-grid">
					{#each group.links as link, li}
						<div class="link-card">
							<div class="avatar">
								{#if link.avatar}
									<img src={link.avatar} alt={link.name} on:error={(e) => (e.currentTarget.style.visibility = "hidden")} />
								{/if}
							</div>
							<div class="info">
								<div class="name">{link.name}</div>
								{#if link.desc}
									<div class="desc">{link.desc}</div>
								{/if}
								<div class="url">{link.url}</div>
							</div>
							<div class="card-actions">
								<button class="mini" on:click={() => openLinkEdit(gi, li)}>编辑</button>
								<button class="mini danger" on:click={() => removeLink(gi, li)}>删除</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="group-foot">
					<button class="btn-ghost" on:click={() => addLink(gi)}>+ 添加友链</button>
				</div>
			</div>
		{/each}

		<div class="toolbar add-group-bar">
			<button class="btn-ghost" on:click={addGroup}>+ 添加分组</button>
		</div>

		{#if groups.length === 0}
			<p class="empty">还没有友链。点击「添加分组」开始创建。</p>
		{/if}
	{/if}

	{#if editingLink}
		<div class="modal-backdrop" on:click={cancelLink}>
			<div class="modal" on:click|stopPropagation>
				<h3>{editingLink.linkIdx >= 0 ? "编辑友链" : "添加友链"}</h3>
				<label>名称 *</label>
				<input value={linkForm.name} on:input={(e) => (linkForm.name = e.currentTarget.value)} placeholder="站点名称" />
				<label>链接 URL *</label>
				<input value={linkForm.url} on:input={(e) => (linkForm.url = e.currentTarget.value)} placeholder="https://example.com" />
				<label>头像 URL</label>
				<input value={linkForm.avatar} on:input={(e) => (linkForm.avatar = e.currentTarget.value)} placeholder="https://example.com/avatar.png" />
				<label>描述</label>
				<input value={linkForm.desc} on:input={(e) => (linkForm.desc = e.currentTarget.value)} placeholder="一句话描述（可选）" />
				<label>博客链接</label>
				<input value={linkForm.blog} on:input={(e) => (linkForm.blog = e.currentTarget.value)} placeholder="可选" />
				<label>主题色</label>
				<input value={linkForm.color} on:input={(e) => (linkForm.color = e.currentTarget.value)} placeholder="#5b8cff（可选）" />
				<div class="modal-actions">
					<button class="btn-ghost" on:click={cancelLink}>取消</button>
					<button class="btn-primary" on:click={saveLink}>保存</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.links-app {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
	.hint {
		color: var(--muted, #6b7280);
		font-size: 0.82rem;
		margin: 0 0 0.5rem;
	}
	.empty {
		color: var(--muted, #6b7280);
		padding: 2rem;
		text-align: center;
	}
	.group-card {
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: var(--radius-large, 0.75rem);
		padding: 1rem;
	}
	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}
	.group-title {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}
	.group-name {
		font-size: 1.05rem;
		font-weight: 600;
		border: 1px solid var(--line-divider, #e5e7eb);
		background: transparent;
		color: var(--deep-text, inherit);
		border-radius: 0.4rem;
		padding: 0.3rem 0.5rem;
		width: 100%;
	}
	.group-desc {
		font-size: 0.85rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		background: transparent;
		color: var(--deep-text, inherit);
		border-radius: 0.4rem;
		padding: 0.25rem 0.5rem;
		width: 100%;
	}
	.group-actions {
		display: flex;
		gap: 0.5rem;
	}
	.links-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
	}
	.link-card {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.6rem;
		transition: border-color 0.2s;
	}
	.link-card:hover {
		border-color: var(--primary, #5b8cff);
	}
	.avatar {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--btn-regular-bg, #f3f4f6);
		border: 1px solid var(--line-divider, #e5e7eb);
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.info {
		flex: 1;
		min-width: 0;
	}
	.name {
		font-weight: 600;
		color: var(--deep-text, inherit);
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.desc {
		font-size: 0.75rem;
		color: var(--muted, #6b7280);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.url {
		font-size: 0.7rem;
		color: var(--muted, #6b7280);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.card-actions {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex-shrink: 0;
	}
	.group-foot {
		margin-top: 0.75rem;
	}
	.add-group-bar {
		justify-content: center;
	}
	.btn-primary {
		padding: 0.5rem 0.9rem;
		background: var(--primary, #5b8cff);
		color: #fff;
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.btn-primary:disabled {
		opacity: 0.6;
	}
	.btn-ghost {
		padding: 0.4rem 0.8rem;
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--deep-text, inherit);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.4rem;
		cursor: pointer;
		font-size: 0.85rem;
	}
	.mini {
		padding: 0.15rem 0.4rem;
		font-size: 0.7rem;
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--deep-text, inherit);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.3rem;
		cursor: pointer;
	}
	.danger {
		color: #dc2626;
		border-color: rgba(220, 38, 38, 0.3);
	}
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}
	.modal {
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: var(--radius-large, 0.75rem);
		padding: 1.25rem;
		width: 90%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.modal h3 {
		margin: 0 0 0.5rem;
		color: var(--deep-text, inherit);
	}
	.modal label {
		font-size: 0.8rem;
		color: var(--muted, #6b7280);
		margin-top: 0.3rem;
	}
	.modal input {
		border: 1px solid var(--line-divider, #e5e7eb);
		background: var(--page-bg, #f6f7fb);
		color: var(--deep-text, inherit);
		border-radius: 0.4rem;
		padding: 0.4rem 0.5rem;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
</style>
