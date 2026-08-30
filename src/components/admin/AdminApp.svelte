<script lang="ts">
import { onMount } from "svelte";
import AdminLogin from "./AdminLogin.svelte";

type Section = string;

let authed = false;
let checking = true;
let username = "";
let checkFailed = false;
let section: Section = "dashboard";
let View: unknown = null;
let viewProps: Record<string, unknown> = {};
let viewError = "";

const VIEWS: Record<string, () => Promise<{ default: unknown }>> = {
	dashboard: () => import("./AdminDashboard.svelte"),
	posts: () => import("./AdminPostList.svelte"),
	"posts-edit": () => import("./AdminPostEditor.svelte"),
	new: () => import("./AdminPostEditor.svelte"),
	links: () => import("./AdminContentEditor.svelte"),
	dynamics: () => import("./AdminDynamic.svelte"),
	notice: () => import("./AdminNoticeEditor.svelte"),
	about: () => import("./AdminContentEditor.svelte"),
	gallery: () => import("./AdminGalleryHub.svelte"),
	"album-edit": () => import("./AdminGalleryAlbum.svelte"),
	settings: () => import("./AdminSettings.svelte"),
};

const VIEW_PROPS: Record<string, Record<string, unknown>> = {
	new: { isNew: true, slug: "" },
	links: { section: "links", apiPath: "/api/links/" },
	about: { section: "about", apiPath: "/api/about/" },
};

// 解析当前 URL → section 与参数
function parsePath(pathname: string): {
	section: Section;
	slug?: string;
	edit?: boolean;
} {
	const parts = pathname
		.replace(/^\/admin\/?/, "")
		.split("/")
		.filter(Boolean);
	if (parts.length === 0) return { section: "dashboard" };
	const [first, second] = parts;
	if (first === "posts") {
		if (second === "new") return { section: "new" };
		if (second === "edit" && parts[2])
			return { section: "posts-edit", slug: decodeURIComponent(parts[2]) };
		return { section: "posts" };
	}
	if (first === "gallery") {
		if (parts[1])
			return { section: "album-edit", slug: decodeURIComponent(parts[1]) };
		return { section: "gallery" };
	}
	if (
		["dashboard", "links", "dynamics", "notice", "about", "settings"].includes(
			first,
		)
	) {
		return { section: first };
	}
	return { section: "dashboard" };
}

async function render(s: Section, slug?: string) {
	section = s;
	viewError = "";
	viewProps = { ...(VIEW_PROPS[s] ?? {}) };
	if ((s === "posts-edit" || s === "album-edit") && slug) {
		viewProps = { slug, ...viewProps };
	}
	const loader = VIEWS[s];
	if (!loader) {
		viewError = "未知页面";
		return;
	}
	try {
		const mod = await loader();
		// 切换时保留旧视图直到新组件就绪，避免"加载中"闪烁
		View = mod.default;
	} catch (e) {
		viewError = e instanceof Error ? e.message : "加载失败";
	}
}

// 登录成功（AdminLogin 回调）：SPA 内直接进入后台，无需整页刷新
function handleLoginSuccess() {
	authed = true;
	checking = false;
	navigate(window.location.pathname);
}

let routeState: { section: Section; edit?: boolean; slug?: string } | null =
	null;

async function navigate(pathname: string) {
	const parsed = parsePath(pathname);
	routeState = parsed;
	await render(parsed.section, parsed.slug);
}

// 拦截侧栏链接：SPA 导航（无刷新）
async function handleNav(event: MouseEvent) {
	const anchor = (event.target as HTMLElement).closest("a");
	if (!anchor) return;
	const href = anchor.getAttribute("href");
	if (!href || !href.startsWith("/admin/")) return;
	if (anchor.getAttribute("target") === "_blank") return;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	event.preventDefault();
	// 列表/编辑器内跳转也走 SPA（如"编辑"按钮）
	if (
		!event.isTrusted ||
		!(event.target as HTMLElement).closest(".admin-sidebar")
	) {
		window.history.pushState({}, "", href);
		await navigate(href);
		return;
	}
	const url = new URL(href, window.location.origin);
	if (url.pathname === window.location.pathname) return;
	window.history.pushState({}, "", href);
	navigate(href);
}

async function checkAuth() {
	// 会话检查：仅 401 判为未登录；网络错误/超时（worker 冷启动可达数秒）自动重试，
	// 避免"检查超时 → 误判登出 → 显示登录表单"（表现为切换选项自动退出登录）
	for (let attempt = 0; attempt < 3; attempt++) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 10000);
		try {
			const resp = await fetch("/api/admin/me/", {
				credentials: "include",
				signal: ctrl.signal,
			});
			if (resp.status === 401) {
				authed = false;
				username = "";
				clearTimeout(timer);
				checking = false;
				return;
			}
			const data = await resp.json();
			if (typeof data.authenticated === "boolean") {
				authed = data.authenticated;
				username = data.username || "";
				clearTimeout(timer);
				checking = false;
				if (authed) {
					await navigate(window.location.pathname);
				}
				return;
			}
		} catch {
			// 网络/超时 → 重试
		}
		clearTimeout(timer);
		if (attempt < 2) {
			await new Promise((r) => setTimeout(r, 800));
		}
	}
	authed = false;
	checkFailed = true;
	checking = false;
}

async function logout() {
	await fetch("/api/admin/logout/", { method: "POST", credentials: "include" });
	window.location.replace("/admin/");
}

onMount(() => {
	checkAuth();
	document.addEventListener("click", handleNav);
	window.addEventListener("popstate", () => navigate(window.location.pathname));
	return () => {
		document.removeEventListener("click", handleNav);
		window.removeEventListener("popstate", () =>
			navigate(window.location.pathname),
		);
	};
});
</script>

{#if !authed && !checking}
	<div class="admin-login-wrap">
		{#if checkFailed}
			<p class="login-hint">会话检查失败，请重试登录</p>
		{/if}
		<AdminLogin onSuccess={handleLoginSuccess} />
	</div>
{:else}
	<div class="admin-shell">
		<aside class="admin-sidebar">
			<div class="admin-brand">Firedre 后台</div>
			<nav>
				<a href="/admin/dashboard/" on:click={handleNav} class:active={section === "dashboard"}>仪表盘</a>
				<a href="/admin/posts/" on:click={handleNav} class:active={section === "posts" || section === "posts-edit" || section === "new"}>文章管理</a>
				<a href="/admin/links/" on:click={handleNav} class:active={section === "links"}>友链管理</a>
				<a href="/admin/notice/" on:click={handleNav} class:active={section === "notice"}>公告管理</a>
				<a href="/admin/dynamics/" on:click={handleNav} class:active={section === "dynamics"}>动态管理</a>
				<a href="/admin/about/" on:click={handleNav} class:active={section === "about"}>关于页</a>
				<a href="/admin/gallery/" on:click={handleNav} class:active={section === "gallery" || section === "album-edit"}>相册管理</a>
				<a href="/admin/settings/" on:click={handleNav} class:active={section === "settings"}>站点设置</a>
			</nav>
			<div class="admin-user">
				<span>{authed ? username : "…"}</span>
				<button on:click={logout} disabled={!authed}>退出</button>
			</div>
		</aside>
		<main class="admin-main">
			{#if checking}
				<div class="admin-loading">会话检查中…</div>
			{:else if !authed}
				<div class="admin-loading">未登录，请前往登录页</div>
			{:else if viewError}
				<div class="admin-error">{viewError}</div>
			{:else if View}
				{#key viewProps.slug ?? section}
					<svelte:component this={View} {...viewProps} />
				{/key}
			{:else}
				<div class="admin-loading">加载中…</div>
			{/if}
		</main>
	</div>
{/if}

<style>
	.admin-shell {
		display: flex;
		min-height: 100vh;
		background: #f6f7fb;
	}
	.admin-sidebar {
		width: 220px;
		flex-shrink: 0;
		background: linear-gradient(180deg, #1e2233 0%, #161a2b 100%);
		color: #e5e7eb;
		display: flex;
		flex-direction: column;
		padding: 1.25rem 0.75rem;
		position: sticky;
		top: 0;
		height: 100vh;
		box-shadow: 2px 0 16px rgb(0 0 0 / 0.08);
	}
	.admin-brand {
		padding: 0 0.75rem 1.25rem;
		font-weight: 800;
		font-size: 1.05rem;
		letter-spacing: 0.02em;
		background: linear-gradient(135deg, #8ab4ff, #c084fc);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.admin-sidebar nav {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.admin-sidebar nav a {
		padding: 0.6rem 0.85rem;
		color: #9aa3b8;
		text-decoration: none;
		font-size: 0.88rem;
		border-radius: 0.6rem;
		transition: all 0.15s;
	}
	.admin-sidebar nav a:hover {
		color: #fff;
		background: rgb(255 255 255 / 0.07);
		transform: translateX(2px);
	}
	.admin-sidebar nav a.active {
		color: #fff;
		background: linear-gradient(135deg, var(--primary, #5b8cff), #8b5cf6);
		box-shadow: 0 2px 10px rgb(91 140 255 / 0.4);
		font-weight: 600;
	}
	.admin-user {
		padding: 1rem 0.75rem 0.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 0.82rem;
		border-top: 1px solid rgb(255 255 255 / 0.08);
	}
	.admin-user span {
		color: #cbd5e1;
		font-weight: 600;
	}
	.admin-user button {
		background: rgb(255 255 255 / 0.06);
		color: #9aa3b8;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 0.5rem;
		padding: 0.35rem 0.7rem;
		cursor: pointer;
		transition: all 0.15s;
	}
	.admin-user button:hover {
		color: #fca5a5;
		border-color: rgb(252 165 165 / 0.4);
		background: rgb(252 165 165 / 0.1);
	}
	.admin-main {
		flex: 1;
		padding: 1.75rem 2rem;
		min-width: 0;
	}
	.admin-loading,
	.admin-unauth {
		text-align: center;
		padding: 4rem;
		color: #666;
	}
	.admin-login-wrap {
		min-height: 90vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}
	.login-hint { color: #dc2626; font-size: 0.85rem; margin: 0; }
	.admin-error {
		padding: 2rem;
		color: #dc2626;
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
