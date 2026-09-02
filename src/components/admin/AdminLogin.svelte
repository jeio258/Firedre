<script lang="ts">
import { onMount } from "svelte";

export let username = "";
export let error = "";
export let loading = false;
export let onSuccess: (() => void) | null = null;

let user = "";
let pass = "";
let needsSetup = false;

onMount(async () => {
	const input = document.querySelector<HTMLInputElement>("#admin-username");
	input?.focus();
	// 若系统尚无管理员，提示进入初始化（创建唯一管理员）
	try {
		const resp = await fetch("/api/admin/setup-status/");
		const data = await resp.json();
		needsSetup = data.setup === true;
	} catch {
		needsSetup = false;
	}
});

async function submit(event: SubmitEvent) {
	event.preventDefault();
	loading = true;
	error = "";
	try {
		const resp = await fetch("/api/admin/login/", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username: user, password: pass }),
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			error = data.message || "登录失败";
			return;
		}

		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const me = await fetch("/api/admin/me/", { credentials: "include" });
				const meData = await me.json();
				if (meData.authenticated) break;
			} catch {
				// 网络抖动忽略
			}
			if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
		}
		if (onSuccess) {
			onSuccess();
		} else {
			window.location.href = "/admin/posts/";
		}
	} catch {
		error = "网络错误，请重试";
	} finally {
		loading = false;
	}
}
</script>

<div class="admin-login">
	<div class="login-card">
		<h1>Firedre 后台管理</h1>
		{#if error}
			<div class="login-error">{error}</div>
		{/if}
		<form on:submit={submit}>
			<label>
				<span>用户名</span>
				<input id="admin-username" type="text" bind:value={user} autocomplete="username" />
			</label>
			<label>
				<span>密码</span>
				<input type="password" bind:value={pass} autocomplete="current-password" />
			</label>
			<button type="submit" disabled={loading}>
				{loading ? "登录中…" : "登 录"}
			</button>
			{#if needsSetup}
				<p class="setup-tip">
					尚未创建管理员，请
					<a href="/admin/setup/">前往初始化</a>
				</p>
			{/if}
		</form>
	</div>
</div>

<style>
	.admin-login {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 70vh;
	}
	.login-card {
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
	.login-error {
		background: rgb(239 68 68 / 0.08);
		color: var(--danger, #b91c1c);
		border: 1px solid rgb(239 68 68 / 0.3);
		border-radius: 0.5rem;
		padding: 0.6rem;
		font-size: 0.85rem;
		margin-bottom: 1rem;
	}
	.setup-tip {
		text-align: center;
		font-size: 0.85rem;
		color: var(--muted-text, #666);
		margin: 0;
	}
	.setup-tip a {
		color: var(--primary, #5b8cff);
		text-decoration: none;
	}
</style>
