<script lang="ts">
import { onMount } from "svelte";

export let section = "";

let authed = false;
let checking = true;
let username = "";

async function checkAuth() {
	try {
		const resp = await fetch("/api/admin/me/", { credentials: "include" });
		const data = await resp.json();
		authed = data.authenticated === true;
		username = data.username || "";
	} catch {
		authed = false;
	}
	checking = false;
}

async function logout() {
	await fetch("/api/admin/logout/", { method: "POST", credentials: "include" });
	// 清除可能残留的会话状态后强制跳转
	window.location.replace("/admin/");
}

onMount(() => {
	checkAuth();
});
</script>

{#if checking}
	<div class="admin-loading">加载中…</div>
{:else if !authed}
	<div class="admin-unauth">
		<p>未登录或会话已过期</p>
		<a class="btn" href="/admin/">前往登录</a>
	</div>
{:else}
	<div class="admin-shell">
		<aside class="admin-sidebar">
			<div class="admin-brand">Firedre 后台</div>
			<nav>
				<a href="/admin/dashboard/" class:active={section === "dashboard"}>仪表盘</a>
				<a href="/admin/posts/" class:active={section === "posts"}>文章管理</a>
				<a href="/admin/posts/new/" class:active={section === "new"}>新建文章</a>
				<a href="/admin/links/" class:active={section === "links"}>友链管理</a>
				<a href="/admin/notice/" class:active={section === "notice"}>公告管理</a>
				<a href="/admin/about/" class:active={section === "about"}>关于页</a>
				<a href="/admin/gallery/" class:active={section === "gallery"}>相册管理</a>
				<a href="/admin/files/" class:active={section === "files"}>HTML 文件</a>
			</nav>
			<div class="admin-user">
				<span>{username}</span>
				<button on:click={logout}>退出</button>
			</div>
		</aside>
		<main class="admin-main">
			<slot />
		</main>
	</div>
{/if}

<style>
	.admin-shell {
		display: flex;
		min-height: 90vh;
	}
	.admin-sidebar {
		width: 200px;
		flex-shrink: 0;
		background: #111827;
		color: #e5e7eb;
		display: flex;
		flex-direction: column;
		padding: 1rem 0;
	}
	.admin-brand {
		padding: 0 1.25rem 1rem;
		font-weight: 700;
		font-size: 1rem;
	}
	.admin-sidebar nav {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.admin-sidebar nav a {
		padding: 0.55rem 1.25rem;
		color: #9ca3af;
		text-decoration: none;
		font-size: 0.9rem;
	}
	.admin-sidebar nav a:hover {
		color: #fff;
		background: rgb(255 255 255 / 0.05);
	}
	.admin-sidebar nav a.active {
		color: #fff;
		background: var(--primary, #5b8cff);
	}
	.admin-user {
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
	.admin-user button {
		background: transparent;
		color: #9ca3af;
		border: 1px solid #374151;
		border-radius: 0.35rem;
		padding: 0.3rem 0.6rem;
		cursor: pointer;
	}
	.admin-main {
		flex: 1;
		padding: 1.5rem 2rem;
		min-width: 0;
	}
	.admin-loading,
	.admin-unauth {
		text-align: center;
		padding: 4rem;
		color: #666;
	}
	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: var(--primary, #5b8cff);
		color: #fff;
		border-radius: 0.5rem;
		text-decoration: none;
	}
</style>
