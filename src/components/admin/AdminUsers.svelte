<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

type UserItem = {
	id: number;
	username: string;
	enabled: boolean;
	created_at: string;
};

let users: UserItem[] = [];
let loading = true;
let message = "";
let error = "";

// 表单状态
let showForm = false;
let formUsername = "";
let formPassword = "";
let editingUser: UserItem | null = null;
let newPassword = "";
let saving = false;

async function load() {
	loading = true;
	error = "";
	try {
		const data = await apiJson<{ users?: unknown[] }>(
			"/api/admin/users/list/",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			},
		);
		users = Array.isArray(data.users) ? (data.users as UserItem[]) : [];
	} catch (e) {
		error = e instanceof Error ? e.message : "网络错误";
	}
	loading = false;
}

function openCreate() {
	editingUser = null;
	formUsername = "";
	formPassword = "";
	showForm = true;
	message = "";
}

function cancelForm() {
	showForm = false;
	editingUser = null;
	formPassword = "";
	newPassword = "";
	message = "";
}

async function createUser() {
	if (!formUsername.trim()) {
		message = "用户名不能为空";
		return;
	}
	if (!formPassword) {
		message = "密码不能为空";
		return;
	}
	saving = true;
	message = "";
	try {
		const resp = await fetch("/api/admin/users/create/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: formUsername.trim(),
				password: formPassword,
			}),
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "创建失败";
			return;
		}
		message = "已创建 ✓";
		showForm = false;
		formUsername = "";
		formPassword = "";
		await load();
	} catch {
		message = "网络错误";
	} finally {
		saving = false;
	}
}

async function savePassword(user: UserItem) {
	if (!newPassword) {
		message = "新密码不能为空";
		return;
	}
	saving = true;
	message = "";
	try {
		const resp = await fetch("/api/admin/users/password/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: user.username, password: newPassword }),
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "修改失败";
			return;
		}
		message = "密码已修改 ✓";
		newPassword = "";
	} catch {
		message = "网络错误";
	} finally {
		saving = false;
	}
}

async function toggleEnabled(user: UserItem) {
	saving = true;
	message = "";
	try {
		const resp = await fetch("/api/admin/users/enabled/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: user.username, enabled: !user.enabled }),
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "操作失败";
			return;
		}
		message = user.enabled ? "已禁用 ✓" : "已启用 ✓";
		await load();
	} catch {
		message = "网络错误";
	} finally {
		saving = false;
	}
}

async function removeUser(user: UserItem) {
	if (!window.confirm(`确定删除用户「${user.username}」吗？`)) return;
	saving = true;
	message = "";
	try {
		const resp = await fetch("/api/admin/users/delete/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: user.username }),
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "删除失败";
			return;
		}
		message = "已删除 ✓";
		await load();
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
		<h2>用户管理</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			{#if !showForm}
				<button class="btn-primary" on:click={openCreate}>+ 添加用户</button>
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
				<h3>添加用户</h3>
				<button class="danger" on:click={cancelForm}>取消</button>
			</div>
			<label class="field">
				<span>用户名 *</span>
				<input type="text" placeholder="登录用户名" bind:value={formUsername} autocomplete="off" />
			</label>
			<label class="field">
				<span>密码 *</span>
				<input type="password" placeholder="登录密码" bind:value={formPassword} autocomplete="new-password" />
			</label>
			<div class="form-actions">
				<button class="btn-primary" on:click={createUser} disabled={saving}>
					{saving ? "创建中…" : "创建"}
				</button>
			</div>
		</div>
	{:else if users.length === 0}
		<p class="hint">暂无用户，点击"添加用户"创建第一个管理员。</p>
	{:else}
		<ul class="list">
			{#each users as user}
				<li class="row">
					<div class="row-main">
						<div class="user-name">
							{user.username}
							{#if !user.enabled}
								<span class="badge muted">已禁用</span>
							{/if}
						</div>
						<div class="user-meta">
							创建于 {user.created_at?.replace("T", " ").slice(0, 19) || "—"}
						</div>
					</div>
					<div class="row-actions">
						<input
							class="pwd-input"
							type="password"
							placeholder="新密码"
							bind:value={newPassword}
							autocomplete="new-password"
						/>
						<button class="btn-ghost" on:click={() => savePassword(user)} disabled={saving}>
							改密
						</button>
						<button class="btn-ghost" on:click={() => toggleEnabled(user)} disabled={saving}>
							{user.enabled ? "禁用" : "启用"}
						</button>
						<button class="danger" on:click={() => removeUser(user)} disabled={saving}>
							删除
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
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
		font-size: 0.85rem;
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
		padding: 0.4rem 0.7rem;
		background: transparent;
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.35rem;
		cursor: pointer;
		color: var(--deep-text, inherit);
	}
	.btn-ghost:disabled {
		opacity: 0.5;
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
		max-width: 420px;
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
	.field input[type="password"] {
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.35rem;
		background: transparent;
		color: var(--deep-text, inherit);
		font-size: 0.9rem;
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
	.user-name {
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.user-meta {
		font-size: 0.78rem;
		color: var(--muted, #6b7280);
		margin-top: 0.2rem;
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
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		flex-wrap: wrap;
	}
	.pwd-input {
		width: 150px;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.35rem;
		background: transparent;
		color: var(--deep-text, inherit);
		font-size: 0.85rem;
	}
</style>
