<script lang="ts">
import { onMount } from "svelte";
import {
	groupTitleOf,
	iconSvg,
	type NavGroup,
	navGroupsFor,
	sectionsOf,
	titleOf,
} from "@/lib/adminNav";
import { persistActiveDraft, runSaveAll } from "@/lib/adminSave";
import AdminSidebar from "./AdminSidebar.svelte";
import AdminThemeSwitch from "./AdminThemeSwitch.svelte";

type Section = string;

let authed = $state(false);
let checking = $state(true);
let username = $state("");
let checkFailed = $state(false);
let isAdmin = $state(false);
let perms = $state<string[]>([]);
let navGroups = $state<NavGroup[]>([]);
let allowed = $state<Set<string>>(new Set());
let section = $state<Section>("dashboard");
let sidebarOpen = $state(false);
let View = $state<import("svelte").Component<Record<string, unknown>> | null>(
	null,
);
let viewProps = $state<Record<string, unknown>>({});
let viewError = $state("");
let viewKey = $state("dashboard");

let userMenuOpen = $state(false);
let pwdPanelOpen = $state(false);
let newPassword = $state("");
let pwdMsg = $state("");
let pwdError = $state("");
let pwdSaving = $state(false);

let collapsed = $state(false);
let settingsCat = $state(0);

function toggleCollapse() {
	collapsed = !collapsed;
	try {
		localStorage.setItem("admin_sidebar_collapsed", collapsed ? "1" : "0");
	} catch (e) {}
}
// 移动端唤出抽屉，桌面端折叠侧栏（断点读取 admin.css 的 --admin-drawer-bp）
function adminDrawerBreakpoint(): number {
	if (typeof window === "undefined") return 767;
	const v = getComputedStyle(document.documentElement)
		.getPropertyValue("--admin-drawer-bp")
		.trim();
	const n = Number.parseInt(v, 10);
	return Number.isFinite(n) ? n : 767;
}
function toggleSidebar() {
	if (
		typeof window !== "undefined" &&
		window.matchMedia(`(max-width: ${adminDrawerBreakpoint()}px)`).matches
	) {
		sidebarOpen = !sidebarOpen;
	} else {
		toggleCollapse();
	}
}
const VIEWS: Record<string, () => Promise<{ default: unknown }>> = {
	dashboard: () => import("./AdminDashboard.svelte"),
	posts: () => import("./AdminPostList.svelte"),
	"posts-edit": () => import("./AdminPostEditor.svelte"),
	new: () => import("./AdminPostEditor.svelte"),
	links: () => import("./AdminFriendsEditor.svelte"),
	sitelinks: () => import("./AdminSiteLinksEditor.svelte"),
	dynamics: () => import("./AdminDynamic.svelte"),
	notice: () => import("./AdminNoticeEditor.svelte"),
	about: () => import("./AdminContentEditor.svelte"),
	gallery: () => import("./AdminGalleryHub.svelte"),
	"album-edit": () => import("./AdminGalleryAlbum.svelte"),
	settings: () => import("./AdminSettings.svelte"),
	users: () => import("./UserList.svelte"),
	comments: () => import("./CommentModeration.svelte"),
	perms: () => import("./PermRequests.svelte"),
};

const VIEW_PROPS: Record<string, Record<string, unknown>> = {
	new: { isNew: true, slug: "" },
	about: { section: "about", apiPath: "/api/about/" },
};

function parsePath(pathname: string): { section: Section; slug?: string } {
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
		if (parts[1]) {
			if (parts[1] === "new") return { section: "album-edit" };
			return { section: "album-edit", slug: decodeURIComponent(parts[1]) };
		}
		return { section: "gallery" };
	}
	if (
		[
			"dashboard",
			"links",
			"sitelinks",
			"dynamics",
			"notice",
			"about",
			"settings",
			"users",
			"comments",
			"perms",
		].includes(first)
	) {
		return { section: first };
	}
	return { section: "dashboard" };
}

async function render(s: Section, slug?: string) {
	persistActiveDraft();
	section = s;
	// 同步标签页标题：登录进入后台后不再残留「登录 -」入口标题，刷新前后一致
	document.title = `${titleOf(section)} - Firedre 后台`;
	viewError = "";
	const loader = VIEWS[s];
	if (!loader) {
		viewError = "未知页面";
		return;
	}
	try {
		const mod = await loader();
		viewProps = { ...(VIEW_PROPS[s] ?? {}) };
		if (s === "settings") viewProps = { ...viewProps, cat: settingsCat };
		if ((s === "posts-edit" || s === "album-edit") && slug) {
			viewProps = { slug, ...viewProps };
		}
		View = mod.default as import("svelte").Component<Record<string, unknown>>;
		viewKey = slug ?? s;
	} catch (e) {
		viewError = e instanceof Error ? e.message : "加载失败";
	}
}

function navigateToLogin() {
	window.location.replace(
		`/login/?next=${encodeURIComponent(window.location.pathname)}`,
	);
}

/** 无权板块的落点：侧栏第一个可见项（权限用户没有仪表盘权限，落点是文章管理） */
function landingTarget(): { section: string; href: string } | null {
	for (const group of navGroups) {
		for (const item of group.items) {
			const target = item.sections[0];
			if (allowed.has(target)) return { section: target, href: item.href };
		}
	}
	return null;
}

async function navigate(pathname: string) {
	const parsed = parsePath(pathname);
	// 手输 URL / 旧书签：无权板块统一落回第一个可见页面，一个板块都没有则回站点首页
	if (!allowed.has(parsed.section)) {
		const target = landingTarget();
		if (!target) {
			window.location.replace("/");
			return;
		}
		if (window.location.pathname !== target.href) {
			window.history.replaceState({}, "", target.href);
		}
		await render(target.section);
		sidebarOpen = false;
		userMenuOpen = false;
		return;
	}
	await render(parsed.section, parsed.slug);
	sidebarOpen = false;
	userMenuOpen = false;
}

async function handleNav(event: MouseEvent) {
	const anchor = (event.target as HTMLElement).closest("a");
	if (!anchor) return;
	const href = anchor.getAttribute("href");
	if (!href?.startsWith("/admin/")) return;
	if (anchor.getAttribute("target") === "_blank") return;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	event.preventDefault();
	if (!event.isTrusted || !(event.target as HTMLElement).closest(".sidebar")) {
		window.history.pushState({}, "", href);
		await navigate(href);
		return;
	}
	const url = new URL(href, window.location.origin);
	if (url.pathname === window.location.pathname) return;
	window.history.pushState({}, "", href);
	await navigate(href);
}

type BackendMe = {
	authenticated?: boolean;
	canAccess?: boolean;
	isAdmin?: boolean;
	username?: string;
	perms?: string[];
};

async function checkAccess() {
	for (let attempt = 0; attempt < 3; attempt++) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 10000);
		try {
			const resp = await fetch("/api/backend/me/", {
				credentials: "include",
				signal: ctrl.signal,
			});
			if (resp.status === 401) {
				clearTimeout(timer);
				navigateToLogin();
				return;
			}
			const data = (await resp.json()) as BackendMe;
			if (typeof data.authenticated !== "boolean") {
				clearTimeout(timer);
			} else {
				clearTimeout(timer);
				if (!data.authenticated) {
					navigateToLogin();
					return;
				}
				if (!data.canAccess) {
					// 已登录但无任何后台权限：回登录页会与「next=/admin/」形成往返，
					// 唯一合理去处是站点首页
					window.location.replace("/");
					return;
				}
				isAdmin = data.isAdmin === true;
				perms = data.perms ?? [];
				username = data.username || "";
				navGroups = navGroupsFor({ isAdmin, perms });
				allowed = sectionsOf(navGroups);
				authed = true;
				checking = false;
				await navigate(window.location.pathname);
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

function logout() {
	fetch("/api/auth/logout/", {
		method: "POST",
		credentials: "include",
	}).finally(() => window.location.replace("/admin/"));
}

function togglePwdPanel() {
	pwdPanelOpen = !pwdPanelOpen;
	if (pwdPanelOpen) {
		pwdMsg = "";
		pwdError = "";
		newPassword = "";
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
		const resp = await fetch("/api/admin/users/password/", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: newPassword }),
		});
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok || data.ok !== true) {
			pwdError = data.message || "修改失败";
			return;
		}
		pwdMsg = "密码已修改";
		newPassword = "";
		setTimeout(() => (pwdMsg = ""), 2600);
	} catch {
		pwdError = "修改失败";
	} finally {
		pwdSaving = false;
	}
}

let saveToast = $state("");
let saveToastKind = $state<"ok" | "err">("ok");
let saveToastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(msg: string, kind: "ok" | "err" = "ok") {
	saveToast = msg;
	saveToastKind = kind;
	if (saveToastTimer) clearTimeout(saveToastTimer);
	saveToastTimer = setTimeout(() => (saveToast = ""), 2600);
}

let savingAll = $state(false);

async function saveAll() {
	if (savingAll) return;
	savingAll = true;
	try {
		await runSaveAllInner();
	} finally {
		savingAll = false;
	}
}

async function runSaveAllInner() {
	const results = await runSaveAll();
	const ok = results.filter((r) => r.ok).length;
	const fail = results.length - ok;
	if (results.length === 0) showToast("当前页面无可保存项", "ok");
	else if (fail === 0) showToast(`已保存 ${ok} 项`, "ok");
	else {
		const failed = results.filter((r) => !r.ok).map((r) => r.label);
		showToast(`保存 ${ok} 成功 / ${fail} 失败：${failed.join("、")}`, "err");
	}
}

onMount(() => {
	try {
		collapsed = localStorage.getItem("admin_sidebar_collapsed") === "1";
	} catch (e) {}
	checkAccess();
	document.addEventListener("click", handleNav);
	const onDocClick = (e: MouseEvent) => {
		// 点击 user-menu 外部时收起下拉/密码面板
		if (!userMenuOpen) return;
		const t = e.target as HTMLElement;
		if (!t.closest(".user-menu")) userMenuOpen = false;
	};
	document.addEventListener("click", onDocClick);
	const onPopState = () => navigate(window.location.pathname);
	window.addEventListener("popstate", onPopState);
	return () => {
		document.removeEventListener("click", handleNav);
		document.removeEventListener("click", onDocClick);
		if (saveToastTimer) clearTimeout(saveToastTimer);
		window.removeEventListener("popstate", onPopState);
	};
});
</script>

{#if checking}
	<div class="admin-checking">正在加载…</div>
{:else if !authed}
	<div class="admin-checking">正在跳转登录…</div>
{:else}
	<div class="shell" class:collapsed={collapsed} data-no-swup>
		{#if sidebarOpen}
			<div class="backdrop open" onclick={() => (sidebarOpen = false)}></div>
		{/if}

		<AdminSidebar
			open={sidebarOpen}
			section={section}
			username={username}
			groups={navGroups}
			roleLabel={isAdmin ? "管理员" : "普通用户"}
			onClose={() => (sidebarOpen = false)}
		/>

		<div class="body">
			<header class="topbar">
				<button class="menu-toggle" aria-label="菜单" onclick={toggleSidebar}>
					{@html iconSvg("menu")}
				</button>
				<div class="crumb">
					<span class="crumb-group">{groupTitleOf(section)}</span>
					<span class="crumb-sep">/</span>
					<h1 class="crumb-page">{titleOf(section)}</h1>
				</div>
				<div class="top-actions">
					{#if section === "settings"}
						<button class="btn btn-primary save-all" onclick={saveAll} disabled={savingAll}>
							{@html iconSvg("save")}<span class="btn-label">保存全部</span>
						</button>
					{/if}
					{#if allowed.has("new")}
						<a class="btn btn-ghost new-post" href="/admin/posts/new/" aria-label="新建文章">
							{@html iconSvg("plus")}<span class="btn-label">新建文章</span>
						</a>
					{/if}
					<span class="actions-divider" aria-hidden="true"></span>
					<span class="theme-slot"><AdminThemeSwitch /></span>
					<a class="icon-btn site-ext" href="/" target="_blank" rel="noopener" aria-label="预览站点">
						{@html iconSvg("external")}
					</a>
					<div class="user-menu">
						<button class="user-trigger" onclick={() => (userMenuOpen = !userMenuOpen)} aria-expanded={userMenuOpen}>
							<img class="avatar" src="/favicon/firefly-32.png" alt="" />
							<span class="user-name">{username || "admin"}</span>
							<span class="caret">▾</span>
						</button>
						{#if userMenuOpen}
							<div class="dropdown open">
								{#if isAdmin}
									<button class="dd-item" onclick={togglePwdPanel}>
										{@html iconSvg("settings")} 修改密码
									</button>
								{/if}
								<button class="dd-item danger" onclick={logout}>
									{@html iconSvg("logout")} 退出登录
								</button>
								{#if pwdPanelOpen}
									<div class="pwd-panel open" onclick={(e) => e.stopPropagation()}>
										<p class="pwd-current">当前管理员：{username || "—"}</p>
										{#if pwdMsg}<p class="pwd-msg ok">{pwdMsg}</p>{/if}
										{#if pwdError}<p class="pwd-msg err">{pwdError}</p>{/if}
										<input
											type="password"
											placeholder="新密码（至少 8 位）"
											bind:value={newPassword}
											autocomplete="new-password"
										/>
										<button class="btn btn-primary" onclick={changePassword} disabled={pwdSaving}>
											{pwdSaving ? "保存中…" : "保存密码"}
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</header>

			<div class="save-toast" class:show={saveToast} class:err={saveToastKind === "err"}>
				{saveToast}
			</div>

			<div class="content">
				<main class="main">
					{#if viewError}
						<div class="admin-error">{viewError}</div>
					{:else if View}
						<View {...viewProps} />
					{:else}
						<div class="admin-loading">加载中…</div>
					{/if}
				</main>
			</div>
		</div>
	</div>
{/if}
