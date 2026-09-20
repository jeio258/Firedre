<script lang="ts">
import { onMount } from "svelte";
import { groupTitleOf, iconSvg, titleOf } from "@/lib/adminNav";
import { persistActiveDraft, runSaveAll } from "@/lib/adminSave";
import AdminLogin from "./AdminLogin.svelte";
import AdminSidebar from "./AdminSidebar.svelte";
import AdminThemeSwitch from "./AdminThemeSwitch.svelte";

type Section = string;

let authed = $state(false);
let checking = $state(true);
let username = $state("");
let checkFailed = $state(false);
let section = $state<Section>("dashboard");
let sidebarOpen = $state(false);
// biome-ignore lint/suspicious/noExplicitAny: 动态视图组件 Props 各异，无法静态收窄
let View = $state<import("svelte").Component<any> | null>(null);
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
let s3open = $state(false);
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
function toggleS3() {
	s3open = !s3open;
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
		View = mod.default;
		viewKey = slug ?? s;
	} catch (e) {
		viewError = e instanceof Error ? e.message : "加载失败";
	}
}

function handleLoginSuccess() {
	authed = true;
	checking = false;
	navigate(window.location.pathname);
}

async function navigate(pathname: string) {
	const parsed = parsePath(pathname);
	await render(parsed.section, parsed.slug);
	sidebarOpen = false;
	userMenuOpen = false;
}
function goSettings(cat: number) {
	settingsCat = cat;
	s3open = true;
	if (section === "settings") {
		render("settings");
	} else {
		window.history.pushState({}, "", "/admin/settings/");
		navigate("/admin/settings/");
	}
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

async function checkAuth() {
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

function logout() {
	fetch("/api/admin/logout/", {
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
	checkAuth();
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
	<AdminLogin onSuccess={handleLoginSuccess} />
{:else}
	<div class="shell" class:collapsed={collapsed} data-no-swup>
		{#if sidebarOpen}
			<div class="backdrop open" onclick={() => (sidebarOpen = false)}></div>
		{/if}

				<AdminSidebar
			open={sidebarOpen}
			section={section}
			settingsCat={settingsCat}
			s3open={s3open}
			username={username}
			onClose={() => (sidebarOpen = false)}
			onToggleS3={toggleS3}
			onGoSettings={goSettings}
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
					<button class="btn btn-primary" onclick={saveAll} disabled={savingAll}>
						{@html iconSvg("save")}<span class="btn-label">保存全部</span>
					</button>
				<a class="btn btn-primary" href="/admin/posts/new/">
					{@html iconSvg("plus")}<span class="btn-label">新建文章</span>
				</a>
				<AdminThemeSwitch />
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
								<button class="dd-item" onclick={togglePwdPanel}>
									{@html iconSvg("settings")} 修改密码
								</button>
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
