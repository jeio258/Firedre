<script lang="ts">
import { onMount } from "svelte";
import "@/styles/admin.css";
import AdminLogin from "./AdminLogin.svelte";
import { iconSvg } from "@/lib/adminIcons";

	type Section = string;

	let authed = false;
	let checking = true;
	let username = "";
	let checkFailed = false;
	let section: Section = "dashboard";
	// 移动端侧栏抽屉开关（≤767px 生效）
	let sidebarOpen = false;
	// 桌面端侧栏折叠（≥768px 生效，图标态）
	let collapsed = false;
	let View: unknown = null;
	let viewProps: Record<string, unknown> = {};
	let viewError = "";

	let viewKey = "dashboard";

	// 顶栏用户菜单
	let userMenuOpen = false;
	// 修改密码
	let pwdPanelOpen = false;
	let newPassword = "";
	let pwdMsg = "";
	let pwdError = "";
	let pwdSaving = false;

	// ── 导航模型（cms-admin 分组风格）──
	interface NavItem {
		label: string;
		href: string;
		icon: string;
		sections: string[];
	}
	const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
		{
			title: "内容管理",
			items: [
				{ label: "仪表盘", href: "/admin/dashboard/", icon: "dashboard", sections: ["dashboard"] },
				{ label: "文章管理", href: "/admin/posts/", icon: "article", sections: ["posts", "posts-edit", "new"] },
			],
		},
		{
			title: "站点模块",
			items: [
				{ label: "友链管理", href: "/admin/links/", icon: "link", sections: ["links"] },
				{ label: "链接管理", href: "/admin/sitelinks/", icon: "sitelink", sections: ["sitelinks"] },
				{ label: "公告管理", href: "/admin/notice/", icon: "notice", sections: ["notice"] },
				{ label: "动态管理", href: "/admin/dynamics/", icon: "dynamics", sections: ["dynamics"] },
				{ label: "关于页", href: "/admin/about/", icon: "about", sections: ["about"] },
				{ label: "相册管理", href: "/admin/gallery/", icon: "gallery", sections: ["gallery", "album-edit"] },
			],
		},
		{
			title: "系统",
			items: [
				{ label: "站点设置", href: "/admin/settings/", icon: "settings", sections: ["settings"] },
			],
		},
	];
	// 标题（顶栏）与快捷入口所属 section
	const SECTION_TITLES: Record<string, string> = {
		dashboard: "仪表盘",
		posts: "文章管理",
		"posts-edit": "编辑文章",
		new: "新建文章",
		links: "友链管理",
		sitelinks: "链接管理",
		notice: "公告管理",
		dynamics: "动态管理",
		about: "关于页",
		gallery: "相册管理",
		"album-edit": "编辑相册",
		settings: "站点设置",
	};

	function isActive(item: NavItem): boolean {
		return item.sections.includes(section);
	}

	// 当前视图所属分组名（顶栏面包屑第一级）
	function groupTitle(): string {
		const group = NAV_GROUPS.find((g) => g.items.some((i) => i.sections.includes(section)));
		return group?.title || "后台";
	}

	function title(): string {
		return SECTION_TITLES[section] || "后台";
	}

	// 顶栏菜单按钮：桌面端折叠/展开侧栏，移动端打开抽屉
	function toggleMenu() {
		if (window.innerWidth > 767) {
			collapsed = !collapsed;
			try {
				localStorage.setItem("admin_sidebar_collapsed", collapsed ? "1" : "0");
			} catch {
				/* 忽略存储异常 */
			}
		} else {
			sidebarOpen = true;
		}
	}

	// ── 视图懒加载 ──
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

	// 解析当前 URL → section 与参数
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
		section = s;
		viewError = "";
		const loader = VIEWS[s];
		if (!loader) {
			viewError = "未知页面";
			return;
		}
		try {
			const mod = await loader();
			viewProps = { ...(VIEW_PROPS[s] ?? {}) };
			if ((s === "posts-edit" || s === "album-edit") && slug) {
				viewProps = { slug, ...viewProps };
			}
			View = mod.default;
			viewKey = slug ?? s;
		} catch (e) {
			viewError = e instanceof Error ? e.message : "加载失败";
		}
	}

	// 登录成功后 SPA 直接进入后台
	function handleLoginSuccess() {
		authed = true;
		checking = false;
		navigate(window.location.pathname);
	}

	async function navigate(pathname: string) {
		const parsed = parsePath(pathname);
		await render(parsed.section, parsed.slug);
		// 移动端点击导航后收起侧栏抽屉
		sidebarOpen = false;
		userMenuOpen = false;
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
		await fetch("/api/admin/logout/", {
			method: "POST",
			credentials: "include",
		});
		window.location.replace("/admin/");
	}

	// 修改密码
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
				body: JSON.stringify({ username, password: newPassword }),
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

	onMount(() => {
		// 恢复桌面侧栏折叠偏好
		try {
			if (localStorage.getItem("admin_sidebar_collapsed") === "1") collapsed = true;
		} catch {
			/* 忽略 */
		}
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

{#if checking}
	<div class="admin-checking">正在加载…</div>
{:else if !authed}
	<div class="admin-login-wrap">
		{#if checkFailed}
			<p class="login-hint">会话检查失败，请重试登录</p>
		{/if}
		<AdminLogin onSuccess={handleLoginSuccess} />
	</div>
{:else}
	<div class="admin-shell" data-no-swup>
		{#if sidebarOpen}
			<div
				class="admin-sidebar-backdrop"
				on:click={() => (sidebarOpen = false)}
			></div>
		{/if}

		<aside class="admin-sidebar" class:open={sidebarOpen} class:collapsed>
			<div class="admin-brand">
				<img class="brand-logo" src="/favicon/firefly-32.png" alt="Firedre" />
				<span class="brand-text">Firedre</span>
				<button
					class="admin-menu-toggle admin-menu-close"
					aria-label="关闭菜单"
					on:click={() => (sidebarOpen = false)}
				>
					✕
				</button>
			</div>

			<nav class="admin-nav">
				{#each NAV_GROUPS as group (group.title)}
					<div class="admin-nav-group">
						<p class="admin-nav-title">{group.title}</p>
						{#each group.items as item (item.href)}
							<a
								href={item.href}
								title={item.label}
								class="admin-nav-item"
								class:active={isActive(item)}
							>
								<span class="admin-nav-icon">
									{@html iconSvg(item.icon)}
								</span>
								<span class="admin-nav-label">{item.label}</span>
							</a>
						{/each}
					</div>
				{/each}
			</nav>

			<div class="admin-side-foot">
				<a
					class="admin-site-link"
					href="/"
					target="_blank"
					rel="noopener"
					title="查看站点"
				>
					<span class="admin-site-link-icon">{@html iconSvg("external")}</span>
					<span class="admin-site-link-label">查看站点</span>
				</a>
				<div class="admin-user">
					<img class="admin-user-avatar" src="/favicon/firefly-32.png" alt="" />
					<div class="admin-user-meta">
						<span class="admin-user-name">{username || "admin"}</span>
						<span class="admin-user-role">管理员</span>
					</div>
				</div>
			</div>
		</aside>

		<div class="admin-body">
			<header class="admin-topbar">
				<button
					class="admin-menu-toggle admin-menu-open"
					aria-label="切换菜单"
					title={collapsed ? "展开侧栏" : "折叠侧栏"}
					on:click={toggleMenu}
				>
					{@html iconSvg("menu")}
				</button>
				<div class="admin-crumb">
					<span class="admin-crumb-group">{groupTitle()}</span>
					<span class="admin-crumb-sep">/</span>
					<h1 class="admin-crumb-page">{title()}</h1>
				</div>
				<div class="admin-topbar-actions">
					{#if section === "posts" || section === "dashboard"}
						<a class="admin-btn admin-btn-primary" href="/admin/posts/new/">
							{@html iconSvg("plus")} 新建文章
						</a>
					{/if}
					<a
						class="admin-icon-btn"
						href="/"
						target="_blank"
						rel="noopener"
						title="查看前台站点"
					>
						{@html iconSvg("external")}
					</a>
					<div class="admin-user-menu">
						<button
							class="admin-user-trigger"
							on:click={() => (userMenuOpen = !userMenuOpen)}
							aria-expanded={userMenuOpen}
						>
							<img class="admin-user-avatar" src="/favicon/firefly-32.png" alt="" />
							<span class="admin-user-name">{username || "admin"}</span>
							<span class="admin-caret">▾</span>
						</button>
						{#if userMenuOpen}
							<div class="admin-dropdown">
								<button class="admin-dropdown-item" on:click={togglePwdPanel}>
									{@html iconSvg("settings")} 修改密码
								</button>
								<button class="admin-dropdown-item danger" on:click={logout}>
									{@html iconSvg("logout")} 退出登录
								</button>
								{#if pwdPanelOpen}
									<div class="admin-pwd-panel" on:click|stopPropagation>
										<p class="admin-pwd-current">当前管理员：{username || "—"}</p>
										{#if pwdMsg}
											<p class="admin-ok">{pwdMsg}</p>
										{/if}
										{#if pwdError}
											<p class="admin-err">{pwdError}</p>
										{/if}
										<input
											type="password"
											placeholder="新密码（至少 8 位）"
											bind:value={newPassword}
											autocomplete="new-password"
										/>
										<button
											class="admin-btn admin-btn-primary admin-pwd-save"
											on:click={changePassword}
											disabled={pwdSaving}
										>
											{pwdSaving ? "保存中…" : "保存密码"}
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</header>

			<main class="admin-main">
				{#if viewError}
					<div class="admin-error">{viewError}</div>
				{:else if View}
					<svelte:component this={View} {...viewProps} />
				{:else}
					<div class="admin-loading">加载中…</div>
				{/if}
			</main>
		</div>
	</div>
{/if}

<style>
	/* ── 应用壳：100dvh 三栏式（侧栏独立 / 内容独立滚动） ── */
	.admin-shell {
		display: flex;
		height: 100dvh;
		overflow: hidden;
		background: var(--page-bg);
	}

	/* 侧栏：随明暗主题令牌，宽 232px，桌面可折叠至 68px 图标态 */
	.admin-sidebar {
		width: 232px;
		flex-shrink: 0;
		background: var(--card-bg);
		border-right: 1px solid var(--line-divider);
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
		transition: width 0.2s ease;
		z-index: 50;
	}
	.admin-brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-shrink: 0;
		min-height: 3.5rem;
		padding: 0.5rem 0.9rem;
		border-bottom: 1px solid var(--line-divider);
	}
	.brand-logo {
		display: inline-block;
		width: 30px;
		height: 30px;
		border-radius: 0.6rem;
		object-fit: contain;
		padding: 4px;
		background: linear-gradient(135deg, var(--primary), var(--title-active));
		flex-shrink: 0;
	}
	.brand-text {
		font-weight: 800;
		font-size: 1.12rem;
		letter-spacing: 0.01em;
		white-space: nowrap;
		overflow: hidden;
		background: linear-gradient(135deg, var(--primary), var(--title-active));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.admin-menu-close {
		display: none;
		margin-left: auto;
	}
	.admin-menu-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: 0.5rem;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: background 0.14s, color 0.14s;
	}
	.admin-menu-toggle:hover {
		background: var(--btn-regular-bg);
		color: var(--deep-text);
	}
	.admin-menu-toggle :global(svg) {
		width: 17px;
		height: 17px;
	}
	.admin-menu-close {
		width: 1.9rem;
		height: 1.9rem;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: none;
	}
	.admin-menu-close:hover {
		color: var(--deep-text);
	}

	.admin-nav {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 0.5rem 0.65rem 0.75rem;
		scrollbar-width: thin;
	}
	.admin-nav-group {
		margin-bottom: 0.75rem;
	}
	.admin-nav-title {
		margin: 0 0 0.2rem;
		padding: 0.5rem 0.6rem 0.2rem;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		text-transform: uppercase;
		white-space: nowrap;
	}
	.admin-nav-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.52rem 0.65rem;
		margin: 1px 0;
		color: var(--deep-text);
		text-decoration: none;
		font-size: 0.88rem;
		border-radius: 0.55rem;
		white-space: nowrap;
		position: relative;
		transition: background 0.14s, color 0.14s;
	}
	.admin-nav-item:hover {
		background: var(--btn-regular-bg);
	}
	.admin-nav-item.active {
		color: var(--primary);
		font-weight: 600;
		background: color-mix(in oklch, var(--primary) 12%, transparent);
	}
	.admin-nav-icon {
		display: inline-flex;
		flex-shrink: 0;
	}
	.admin-nav-icon :global(svg) {
		width: 18px;
		height: 18px;
	}
	.admin-nav-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* 侧栏底部：前台入口 + 用户信息 */
	.admin-side-foot {
		flex-shrink: 0;
		border-top: 1px solid var(--line-divider);
		padding: 0.6rem 0.75rem 0.7rem;
	}
	.admin-site-link {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.45rem 0.65rem;
		border-radius: 0.55rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.85rem;
		transition: background 0.14s, color 0.14s;
	}
	.admin-site-link:hover {
		color: var(--primary);
		background: var(--btn-regular-bg);
	}
	.admin-site-link-icon {
		display: inline-flex;
		flex-shrink: 0;
	}
	.admin-site-link-icon :global(svg) {
		width: 17px;
		height: 17px;
	}
	.admin-site-link-label {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
	}
	.admin-user {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.65rem 0.1rem;
	}
	.admin-user-avatar {
		display: inline-block;
		width: 30px;
		height: 30px;
		border-radius: 999px;
		object-fit: contain;
		padding: 3px;
		background: linear-gradient(135deg, var(--primary), var(--title-active));
		flex-shrink: 0;
	}
	.admin-user-meta {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.admin-user-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--deep-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.admin-user-role {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	/* 折叠图标态（仅 ≥768px 生效） */
	@media (min-width: 768px) {
		.admin-sidebar.collapsed {
			width: 68px;
		}
		.admin-sidebar.collapsed .admin-brand {
			justify-content: center;
			padding: 0.5rem 0;
		}
		.admin-sidebar.collapsed .brand-text,
		.admin-sidebar.collapsed .admin-nav-title,
		.admin-sidebar.collapsed .admin-nav-label,
		.admin-sidebar.collapsed .admin-site-link-label,
		.admin-sidebar.collapsed .admin-user-meta {
			display: none;
		}
		.admin-sidebar.collapsed .admin-nav-item,
		.admin-sidebar.collapsed .admin-site-link {
			justify-content: center;
			padding: 0.55rem 0;
		}
		.admin-sidebar.collapsed .admin-user {
			justify-content: center;
			padding: 0.6rem 0 0.1rem;
		}
	}

	/* ── 右侧主体（顶栏 + 内容画布） ── */
	.admin-body {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.admin-topbar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.7rem;
		height: 3.5rem;
		padding: 0 1.2rem;
		background: color-mix(in srgb, var(--card-bg) 82%, transparent);
		backdrop-filter: saturate(1.4) blur(10px);
		-webkit-backdrop-filter: saturate(1.4) blur(10px);
		border-bottom: 1px solid var(--line-divider);
		z-index: 40;
	}
	.admin-crumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.admin-crumb-group {
		font-size: 0.82rem;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.admin-crumb-sep {
		color: var(--line-color);
		font-size: 0.8rem;
	}
	.admin-crumb-page {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: var(--deep-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.admin-topbar-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.admin-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: none;
		transition: background 0.14s, color 0.14s;
	}
	.admin-icon-btn:hover {
		background: var(--btn-regular-bg);
		color: var(--primary);
	}
	.admin-icon-btn :global(svg) {
		width: 17px;
		height: 17px;
	}

	/* 按钮 */
	.admin-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.42rem 0.9rem;
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: 0.55rem;
		border: 1px solid transparent;
		text-decoration: none;
		cursor: pointer;
		transition: filter 0.14s, opacity 0.14s;
	}
	.admin-btn :global(svg) {
		width: 15px;
		height: 15px;
	}
	.admin-btn-primary {
		background: linear-gradient(135deg, var(--primary), var(--title-active));
		color: var(--on-accent);
	}
	.admin-btn-primary:hover {
		filter: brightness(1.06);
	}
	.admin-btn-primary:disabled {
		opacity: 0.6;
		cursor: default;
	}

	/* 用户菜单下拉 */
	.admin-user-menu {
		position: relative;
	}
	.admin-user-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.55rem 0.3rem 0.3rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 0.6rem;
		cursor: pointer;
		transition: background 0.14s;
	}
	.admin-user-trigger:hover {
		background: var(--btn-regular-bg);
	}
	.admin-user-trigger .admin-user-name {
		font-size: 0.83rem;
	}
	.admin-caret {
		font-size: 0.7rem;
		color: var(--text-muted);
	}
	.admin-dropdown {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		min-width: 240px;
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		border-radius: 0.7rem;
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.12);
		padding: 0.4rem;
		z-index: 60;
	}
	.admin-dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		padding: 0.5rem 0.7rem;
		background: transparent;
		border: none;
		border-radius: 0.45rem;
		font-size: 0.85rem;
		color: var(--deep-text);
		cursor: pointer;
		text-align: left;
	}
	.admin-dropdown-item :global(svg) {
		width: 15px;
		height: 15px;
		opacity: 0.7;
	}
	.admin-dropdown-item:hover {
		background: var(--btn-regular-bg);
	}
	.admin-dropdown-item.danger {
		color: var(--danger);
	}
	.admin-pwd-panel {
		margin-top: 0.35rem;
		border-top: 1px solid var(--line-divider);
		padding: 0.65rem 0.5rem 0.35rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.admin-pwd-current {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.admin-pwd-panel input {
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.45rem;
		background: transparent;
		color: var(--deep-text);
		font-size: 0.85rem;
	}
	.admin-pwd-save {
		justify-content: center;
	}
	.admin-ok {
		color: var(--success);
		font-size: 0.8rem;
		margin: 0;
	}
	.admin-err {
		color: var(--danger);
		font-size: 0.8rem;
		margin: 0;
	}

	/* 内容画布：独立滚动 + 顶部主题色微光 */
	.admin-main {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 1.6rem 1.75rem 2.5rem;
		background:
			radial-gradient(
				1200px 420px at 85% -10%,
				color-mix(in oklch, var(--primary) 8%, transparent),
				transparent 60%
			),
			var(--page-bg);
	}

	.admin-sidebar-backdrop {
		display: none;
	}

	/* 加载/错误/登录态 */
	.admin-loading {
		text-align: center;
		padding: 4rem;
		color: var(--text-muted);
	}
	.admin-checking {
		min-height: 90vh;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
	}
	.admin-login-wrap {
		min-height: 90vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}
	.login-hint {
		color: var(--danger);
		font-size: 0.85rem;
		margin: 0;
	}
	.admin-error {
		padding: 2rem;
		color: var(--danger);
	}

	/* 移动端：侧栏抽屉 + 遮罩，顶栏收紧 */
	@media (max-width: 767px) {
		.admin-menu-close {
			display: inline-flex;
		}
		.admin-sidebar {
			position: fixed;
			top: 0;
			left: 0;
			height: 100dvh;
			width: min(17rem, 84vw);
			z-index: 60;
			transform: translateX(-100%);
			transition: transform 0.22s ease;
		}
		.admin-sidebar.open {
			transform: translateX(0);
		}
		.admin-sidebar-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 55;
			background: rgb(0 0 0 / 0.4);
		}
		.admin-topbar {
			padding: 0 0.8rem;
		}
		.admin-crumb-group {
			display: none;
		}
		.admin-crumb-sep {
			display: none;
		}
		.admin-main {
			padding: 1rem 0.85rem 1.6rem;
		}
	}
</style>
