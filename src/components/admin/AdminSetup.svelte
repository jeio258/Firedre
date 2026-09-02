<script lang="ts">
import { onMount } from "svelte";

let checking = true;
let alreadyConfigured = false;
let username = "";
let password = "";
let confirm = "";
let error = "";
let loading = false;
let done = false;

async function check() {
	try {
		const resp = await fetch("/api/admin/setup-status/");
		const data = await resp.json();
		alreadyConfigured = data.setup === false;
	} catch {
		alreadyConfigured = false;
	}
	checking = false;
}

async function submit(event: SubmitEvent) {
	event.preventDefault();
	error = "";
	if (!username.trim()) {
		error = "用户名不能为空";
		return;
	}
	if (password.length < 8) {
		error = "密码至少 8 位";
		return;
	}
	if (password !== confirm) {
		error = "两次输入的密码不一致";
		return;
	}
	loading = true;
	try {
		const resp = await fetch("/api/admin/setup/", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: username.trim(), password }),
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			error = data.message || "创建失败";
			return;
		}
		done = true;
		// 创建成功后已自动登录，进入后台
		window.location.href = "/admin/dashboard/";
	} catch {
		error = "网络错误，请重试";
	} finally {
		loading = false;
	}
}

onMount(() => {
	check();
});
</script>

<div class="setup-wrap">
	<div class="setup-card">
		<h1>初始化后台</h1>
		<p class="sub">创建系统唯一的管理员账户，创建后即可登录后台。</p>
		{#if checking}
			<p class="hint">加载中…</p>
		{:else if alreadyConfigured}
			<p class="hint">
				管理员已存在。请前往
				<a href="/admin/">登录页面</a>
				。
			</p>
		{:else if done}
			<p class="hint">创建成功，正在进入后台…</p>
		{:else}
			{#if error}
				<div class="error">{error}</div>
			{/if}
			<form on:submit={submit}>
				<label>
					<span>用户名</span>
					<input type="text" bind:value={username} autocomplete="username" />
				</label>
				<label>
					<span>密码</span>
					<input type="password" bind:value={password} autocomplete="new-password" />
				</label>
				<label>
					<span>确认密码</span>
					<input type="password" bind:value={confirm} autocomplete="new-password" />
				</label>
				<button type="submit" disabled={loading}>
					{loading ? "创建中…" : "创建管理员"}
				</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.setup-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 70vh;
	}
	.setup-card {
		width: 100%;
		max-width: 360px;
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.06);
	}
	h1 {
		font-size: 1.25rem;
		text-align: center;
		margin: 0 0 0.4rem;
	}
	.sub {
		font-size: 0.85rem;
		color: var(--muted-text, #666);
		text-align: center;
		margin: 0 0 1.5rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: var(--muted-text, #666);
	}
	input {
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.5rem;
		font-size: 0.95rem;
		background: var(--card-bg, #fff);
		color: var(--deep-text, inherit);
	}
	button {
		padding: 0.7rem;
		background: var(--primary, #5b8cff);
		color: var(--on-accent, #fff);
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
	}
	.error {
		background: rgb(239 68 68 / 0.08);
		color: var(--danger, #b91c1c);
		border: 1px solid rgb(239 68 68 / 0.3);
		border-radius: 0.5rem;
		padding: 0.6rem;
		font-size: 0.85rem;
		margin-bottom: 1rem;
	}
	.hint {
		color: var(--text-muted, #666);
		text-align: center;
	}
	.hint a {
		color: var(--primary, #5b8cff);
	}
</style>
