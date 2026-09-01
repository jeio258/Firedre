<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

let stats = {
	posts: "-",
	dynamics: "-",
	links: "-",
	tags: "-",
	categories: "-",
};
let loading = true;

// 管理员账户（唯一管理员）改密
let accountUsername = "";
let newPassword = "";
let pwdMsg = "";
let pwdError = "";
let pwdSaving = false;

async function loadAccount() {
	try {
		const me = await apiJson<{ authenticated?: boolean; username?: string }>(
			"/api/admin/me/",
		);
		accountUsername = me.username || "";
	} catch {
		// 忽略，改密仍需登录态
	}
}

async function changePassword() {
	pwdMsg = "";
	pwdError = "";
	if (!newPassword) {
		pwdError = "新密码不能为空";
		return;
	}
	if (newPassword.length < 8) {
		pwdError = "密码至少 8 位";
		return;
	}
	pwdSaving = true;
	try {
		await apiJson("/api/admin/users/password/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: accountUsername, password: newPassword }),
		});
		pwdMsg = "密码已修改 ✓";
		newPassword = "";
	} catch (e) {
		pwdError = e instanceof Error ? e.message : "修改失败";
	} finally {
		pwdSaving = false;
	}
}

onMount(async () => {
	try {
		const [posts, dynamics, friends, tags, categories] = await Promise.all([
			await apiJson("/api/posts/?pageSize=1"),
			await apiJson("/api/dynamics/"),
			await apiJson("/api/friends/"),
			await apiJson("/api/posts/taxonomy/tags/"),
			await apiJson("/api/posts/taxonomy/categories/"),
		]);
		stats = {
			posts: String(posts.total ?? 0),
			dynamics: String(dynamics.total ?? 0),
			links: String((friends.items || []).length),
			tags: String((tags.tags || []).length),
			categories: String((categories.categories || []).length),
		};
	} catch {
		// 忽略统计失败
	}
	loading = false;
	await loadAccount();
});
</script>

<div class="admin-card">
	<h2>仪表盘</h2>
	{#if loading}
		<p class="hint">加载中…</p>
	{:else}
		<div class="stats">
			<div class="stat">
				<div class="num">{stats.posts}</div>
				<div class="label">文章</div>
			</div>
			<div class="stat">
				<div class="num">{stats.dynamics}</div>
				<div class="label">动态</div>
			</div>
			<div class="stat">
				<div class="num">{stats.links}</div>
				<div class="label">友链</div>
			</div>
			<div class="stat">
				<div class="num">{stats.tags}</div>
				<div class="label">标签</div>
			</div>
			<div class="stat">
				<div class="num">{stats.categories}</div>
				<div class="label">分类</div>
			</div>
		</div>
		<div class="links">
			<a href="/admin/posts/">管理文章</a>
			<a href="/admin/posts/new/">写新文章</a>
			<a href="/admin/links/">友链</a>
			<a href="/admin/gallery/">相册</a>
		</div>
		<div class="account-block">
			<h3>管理员账户</h3>
			<p class="account-name">当前管理员：{accountUsername || "—"}</p>
			{#if pwdMsg}
				<p class="ok">{pwdMsg}</p>
			{/if}
			{#if pwdError}
				<p class="err">{pwdError}</p>
			{/if}
			<div class="pwd-row">
				<input
					type="password"
					placeholder="新密码"
					bind:value={newPassword}
					autocomplete="new-password"
				/>
				<button on:click={changePassword} disabled={pwdSaving}>
					{pwdSaving ? "修改中…" : "修改密码"}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.admin-card {
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: var(--radius-large, 0.75rem);
		padding: 1.5rem;
	}
	h2 {
		font-size: 1.15rem;
		margin: 0 0 1.25rem;
		color: var(--deep-text, inherit);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.stat {
		background: var(--btn-regular-bg, #f9fafb);
		border-radius: 0.6rem;
		padding: 1.25rem;
		text-align: center;
	}
	.num {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--primary, #5b8cff);
	}
	.label {
		font-size: 0.85rem;
		color: var(--muted, #6b7280);
		margin-top: 0.3rem;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.links a {
		padding: 0.5rem 1rem;
		background: var(--btn-regular-bg, #f9fafb);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.5rem;
		text-decoration: none;
		color: var(--deep-text, #374151);
		font-size: 0.9rem;
	}
	.links a:hover {
		border-color: var(--primary, #5b8cff);
		color: var(--primary, #5b8cff);
	}
	.hint {
		color: var(--muted, #6b7280);
	}
	.account-block {
		margin-top: 2rem;
		border-top: 1px solid var(--line-divider, #e5e7eb);
		padding-top: 1.25rem;
	}
	.account-block h3 {
		font-size: 1rem;
		margin: 0 0 0.5rem;
		color: var(--deep-text, inherit);
	}
	.account-name {
		font-size: 0.9rem;
		color: var(--muted, #6b7280);
		margin: 0 0 0.75rem;
	}
	.pwd-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.pwd-row input {
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.4rem;
		background: transparent;
		color: var(--deep-text, inherit);
		font-size: 0.9rem;
		width: 220px;
	}
	.pwd-row button {
		padding: 0.5rem 0.9rem;
		background: var(--primary, #5b8cff);
		color: #fff;
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.pwd-row button:disabled {
		opacity: 0.6;
	}
	.ok {
		color: #16a34a;
		font-size: 0.85rem;
		margin: 0.25rem 0 0.5rem;
	}
	.err {
		color: #dc2626;
		font-size: 0.85rem;
		margin: 0.25rem 0 0.5rem;
	}
	/* 移动端：改密行纵向堆叠，输入框全宽 */
	@media (max-width: 767px) {
		.pwd-row {
			flex-direction: column;
			align-items: stretch;
		}
		.pwd-row input {
			width: 100%;
		}
	}
</style>
