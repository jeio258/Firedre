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
	let searchQuery = "";

	// 编辑态：分组名/描述是否在编辑中
	let editingGroup: number | null = null;
	let editingLink: { groupIdx: number; linkIdx: number } | null = null;
	let linkForm: FriendLinkItem = emptyLink();

	function emptyLink(): FriendLinkItem {
		return {
			url: "",
			avatar: "",
			name: "",
			desc: "",
			blog: "",
			color: "",
			siteshot: "",
		};
	}

	// 搜索过滤（对齐前端：按名称/描述匹配，跨全部分组展平展示）
	$: displayGroups = (() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return groups;
		return groups
			.map((g) => ({
				...g,
				links: (g.links || []).filter(
					(l) =>
						(l.name || "").toLowerCase().includes(q) ||
						(l.desc || "").toLowerCase().includes(q),
				),
			}))
			.filter((g) => (g.links || []).length > 0);
	})();

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
		editingGroup = groups.length - 1;
		message = "有未保存的修改";
	}

	function removeGroup(idx: number) {
		if (!window.confirm("确认删除该分组及其全部友链？")) return;
		groups = groups.filter((_, i) => i !== idx);
		message = "有未保存的修改";
	}

	function updateGroupName(idx: number, val: string) {
		const next = [...groups];
		next[idx] = { ...next[idx], name: val };
		groups = next;
	}

	function updateGroupDesc(idx: number, val: string) {
		const next = [...groups];
		next[idx] = { ...next[idx], desc: val };
		groups = next;
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
		const g = {
			...next[editingLink.groupIdx],
			links: [...next[editingLink.groupIdx].links],
		};
		if (editingLink.linkIdx >= 0) {
			g.links[editingLink.linkIdx] = item;
		} else {
			g.links.push(item);
		}
		next[editingLink.groupIdx] = g;
		groups = next;
		editingLink = null;
		message = "有未保存的修改";
	}

	function cancelLink() {
		editingLink = null;
	}

	function removeLink(groupIdx: number, linkIdx: number) {
		if (!window.confirm("确认删除该友链？")) return;
		const next = [...groups];
		const g = {
			...next[groupIdx],
			links: next[groupIdx].links.filter((_, i) => i !== linkIdx),
		};
		next[groupIdx] = g;
		groups = next;
		message = "有未保存的修改";
	}

	onMount(load);
</script>

<div class="links-app">
	<!-- 顶部工具条 -->
	<div class="toolbar">
		<div class="toolbar-left">
			<h2>友链管理</h2>
			<div class="hint">管理与前端友链页一致的友链卡片，增删改后点「保存」生效。</div>
		</div>
		<div class="toolbar-right">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>

	<!-- 搜索框（对齐前端） -->
	<div class="search-bar">
		<svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.3-4.3" />
		</svg>
		<input
			type="text"
			placeholder="搜索友链..."
			value={searchQuery}
			on:input={(e) => (searchQuery = e.currentTarget.value)}
		/>
	</div>

	{#if loading}
		<p class="empty">加载中…</p>
	{:else}
		{#each displayGroups as group, gi}
			<div class="group-block">
				<!-- 分组标题行（静态展示，点击进入编辑） -->
				<div class="group-head">
					<div class="group-title">
						{#if editingGroup === gi}
							<div class="group-edit">
								<input
									value={group.name ?? ""}
									placeholder="分组名称"
									on:input={(e) => updateGroupName(gi, e.currentTarget.value)}
									on:blur={() => (editingGroup = null)}
									on:keydown={(e) => e.key === "Enter" && (editingGroup = null)}
								/>
								<input
									class="group-desc-input"
									value={group.desc ?? ""}
									placeholder="分组描述（可选）"
									on:input={(e) => updateGroupDesc(gi, e.currentTarget.value)}
									on:blur={() => (editingGroup = null)}
									on:keydown={(e) => e.key === "Enter" && (editingGroup = null)}
								/>
							</div>
						{:else}
							<div class="group-title-text">
								<span class="group-name-text">{group.name || "未命名分组"}</span>
								{#if group.desc}
									<span class="group-desc-text">{group.desc}</span>
								{/if}
								<span class="group-count">{group.links.length} 个友链</span>
							</div>
						{/if}
					</div>
					<div class="group-actions">
						{#if editingGroup !== gi}
							<button class="btn-ghost" on:click={() => (editingGroup = gi)}>编辑分组</button>
						{/if}
						<button class="btn-ghost danger" on:click={() => removeGroup(gi)}>删除分组</button>
					</div>
				</div>

				<!-- 友链卡片网格（对齐前端 friends.astro 样式） -->
				<div class="friends-grid">
					{#each group.links as link, li}
						<div class="friend-card">
							<!-- 外部链接角标 -->
							<svg class="arrow-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M7 17 17 7" />
								<path d="M7 7h10v10" />
							</svg>

							<!-- 头像 -->
							<div class="avatar">
								{#if link.avatar}
									<img src={link.avatar} alt={link.name} on:error={(e) => (e.currentTarget.style.visibility = "hidden")} />
								{/if}
							</div>

							<!-- 内容 -->
							<div class="info">
								<div class="name">{link.name}</div>
								<div class="desc">{link.desc || "—"}</div>
								<div class="url">{link.url}</div>
							</div>

							<!-- 操作 -->
							<div class="card-actions">
								<button class="mini" on:click={() => openLinkEdit(gi, li)} title="编辑">
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
								</button>
								<button class="mini danger" on:click={() => removeLink(gi, li)} title="删除">
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
								</button>
							</div>
						</div>
					{/each}

					{#if group.links.length === 0}
						<div class="empty-card">该分组暂无友链</div>
					{/if}
				</div>

				<div class="group-foot">
					<button class="btn-ghost add-link" on:click={() => addLink(gi)}>+ 添加友链</button>
				</div>
			</div>
		{/each}

		{#if displayGroups.length === 0 && searchQuery.trim()}
			<div class="no-result">没有找到匹配「{searchQuery}」的友链</div>
		{/if}

		{#if groups.length === 0}
			<p class="empty">还没有友链。点击「添加分组」开始创建。</p>
		{/if}

		<div class="add-group-bar">
			<button class="btn-primary outline" on:click={addGroup}>+ 添加分组</button>
		</div>
	{/if}

	<!-- 友链编辑弹窗 -->
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
	/* ---- 工具条 ---- */
	.toolbar {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	.toolbar-left {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0;
		color: var(--deep-text, inherit);
	}
	.hint {
		color: var(--muted, #6b7280);
		font-size: 0.82rem;
	}
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.msg {
		color: #16a34a;
		font-size: 0.85rem;
	}
	/* ---- 搜索框（对齐前端）---- */
	.search-bar {
		position: relative;
		display: flex;
		align-items: center;
	}
	.search-bar .search-icon {
		position: absolute;
		left: 12px;
		color: var(--muted, #9ca3af);
		pointer-events: none;
	}
	.search-bar input {
		width: 100%;
		padding: 0.6rem 0.8rem 0.6rem 2.5rem;
		border-radius: 0.75rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		background: transparent;
		color: var(--deep-text, inherit);
		font-size: 0.9rem;
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
	}
	.search-bar input:focus {
		border-color: var(--primary, #5b8cff);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary, #5b8cff) 25%, transparent);
	}
	/* ---- 分组 ---- */
	.group-block {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.group-title-text {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.group-name-text {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--deep-text, inherit);
	}
	.group-desc-text {
		font-size: 0.85rem;
		color: var(--muted, #6b7280);
	}
	.group-count {
		font-size: 0.75rem;
		color: var(--muted, #6b7280);
		background: var(--btn-regular-bg, #f3f4f6);
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
	}
	.group-edit {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1;
	}
	.group-edit input {
		border: 1px solid var(--primary, #5b8cff);
		background: transparent;
		color: var(--deep-text, inherit);
		border-radius: 0.4rem;
		padding: 0.35rem 0.6rem;
		font-size: 0.95rem;
		width: 100%;
		max-width: 320px;
	}
	.group-edit .group-desc-input {
		font-size: 0.85rem;
	}
	.group-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	/* ---- 友链卡片网格（对齐前端 friends.astro）---- */
	.friends-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.75rem;
	}
	.friend-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		background: var(--card-bg, #fff);
		overflow: hidden;
		transition: border-color 0.3s, box-shadow 0.3s, background 0.3s;
	}
	.friend-card:hover {
		border-color: var(--primary, #5b8cff);
		background: color-mix(in srgb, var(--card-bg, #fff) 60%, var(--primary, #5b8cff) 4%);
		box-shadow: 0 8px 24px -12px color-mix(in srgb, var(--primary, #5b8cff) 40%, transparent);
	}
	.arrow-icon {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		color: var(--primary, #5b8cff);
		opacity: 0;
		transition: opacity 0.3s, transform 0.3s;
	}
	.friend-card:hover .arrow-icon {
		opacity: 1;
	}
	.avatar {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
		border-radius: 0.75rem;
		overflow: hidden;
		background: var(--btn-regular-bg, #f3f4f6);
		border: 1px solid var(--line-divider, #e5e7eb);
		transition: transform 0.3s;
	}
	.friend-card:hover .avatar {
		transform: scale(1.05);
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.name {
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--deep-text, inherit);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding-right: 1.5rem;
	}
	.desc {
		font-size: 0.8rem;
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
		gap: 0.3rem;
		flex-shrink: 0;
		opacity: 0.4;
		transition: opacity 0.3s;
	}
	.friend-card:hover .card-actions {
		opacity: 1;
	}
	.empty-card {
		grid-column: 1 / -1;
		padding: 1.5rem;
		text-align: center;
		color: var(--muted, #6b7280);
		border: 1px dashed var(--line-divider, #e5e7eb);
		border-radius: 0.75rem;
		font-size: 0.85rem;
	}
	.group-foot {
		display: flex;
	}
	.add-link {
		margin-left: auto;
	}
	.add-group-bar {
		display: flex;
		justify-content: center;
		margin-top: 0.5rem;
	}
	/* ---- 按钮 ---- */
	.btn-primary {
		padding: 0.5rem 0.9rem;
		background: var(--primary, #5b8cff);
		color: #fff;
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
		font-size: 0.9rem;
	}
	.btn-primary:disabled {
		opacity: 0.6;
	}
	.btn-primary.outline {
		background: transparent;
		color: var(--primary, #5b8cff);
		border: 1px solid var(--primary, #5b8cff);
	}
	.btn-ghost {
		padding: 0.35rem 0.75rem;
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--deep-text, inherit);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.4rem;
		cursor: pointer;
		font-size: 0.82rem;
	}
	.mini {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--deep-text, inherit);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.35rem;
		cursor: pointer;
	}
	.danger {
		color: #dc2626;
		border-color: rgba(220, 38, 38, 0.3);
	}
	.mini.danger {
		color: #dc2626;
	}
	.empty {
		color: var(--muted, #6b7280);
		padding: 2rem;
		text-align: center;
	}
	.no-result {
		padding: 2rem;
		text-align: center;
		color: var(--muted, #6b7280);
		border: 1px dashed var(--line-divider, #e5e7eb);
		border-radius: 0.75rem;
		font-size: 0.9rem;
	}
	/* ---- 弹窗 ---- */
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
