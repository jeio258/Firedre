<script lang="ts">
	import { onMount } from "svelte";
	import "@/styles/admin.css";
	import AdminLogin from "./AdminLogin.svelte";

	type Section = string;

	let authed = false;
	let checking = true;
	let username = "";
	let checkFailed = false;
	let section: Section = "dashboard";
	// 移动端侧栏抽屉开关（≤767px 生效）
	let sidebarOpen = false;
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

	const ICONS: Record<string, string> = {
		dashboard:
			'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
		article:
			'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
		link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
		sitelink: '<path d="M9 12h6"/><path d="M12 9v6"/><rect x="3" y="5" width="18" height="14" rx="2"/>',
		notice: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
		dynamics:
			'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
		about: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
		plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
		logout:
			'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
		gallery:
			'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
		settings:
			'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
	};
	function icon(name: string): string {
		return ICONS[name] || ICONS.settings;
	}

	function isActive(item: NavItem): boolean {
		return item.sections.includes(section);
	}

	function title(): string {
		return SECTION_TITLES[section] || "后台";
	}

	function iconSvg(name: string): string {
		return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">${icon(name)}</svg>`;
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

		<aside class="admin-sidebar" class:open={sidebarOpen}>
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

			<div class="admin-user">
				<div class="admin-user-row">
					<img class="admin-user-avatar" src="/favicon/firefly-32.png" alt="" />
					<span class="admin-user-name">{username || "admin"}</span>
				</div>
			</div>
		</aside>

		<div class="admin-body">
			<header class="admin-topbar">
				<button
					class="admin-menu-toggle admin-menu-open"
					aria-label="打开菜单"
					on:click={() => (sidebarOpen = true)}
				>
					☰
				</button>
				<div class="admin-topbar-title">
					<h1>{title()}</h1>
				</div>
				<div class="admin-topbar-actions">
					{#if section === "posts" || section === "dashboard"}
						<a class="admin-btn admin-btn-primary" href="/admin/posts/new/">
							{@html iconSvg("plus")} 新建文章
						</a>
					{/if}
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
	/* ── 外壳：浅色随项目主题令牌（明暗双态） ── */
	.admin-shell {
		display: flex;
		min-height: 100vh;
		background: var(--page-bg);
	}

	/* 侧栏：卡片底色 + 细分隔线（浅色模式接近 cms-admin 白底，暗色为深色卡） */
	.admin-sidebar {
		width: 232px;
		flex-shrink: 0;
		background: var(--card-bg);
		border-right: 1px solid var(--line-divider);
		display: flex;
		flex-direction: column;
		padding: 1rem 0.75rem 1rem;
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-y: auto;
	}
	.admin-brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.25rem 0.75rem 1.1rem;
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
		background: linear-gradient(135deg, var(--primary), var(--title-active));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.admin-menu-toggle {
		display: none;
	}

	.admin-nav {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.admin-nav-group {
		margin-bottom: 0.85rem;
	}
	.admin-nav-title {
		margin: 0 0 0.25rem;
		padding: 0 0.75rem;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		text-transform: uppercase;
	}
	.admin-nav-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.5rem 0.75rem;
		margin: 1px 0;
		color: var(--deep-text);
		opacity: 0.72;
		text-decoration: none;
		font-size: 0.9rem;
		border-radius: 0.55rem;
		transition: background 0.14s, opacity 0.14s;
	}
	.admin-nav-item:hover {
		opacity: 1;
		background: color-mix(in oklch, var(--primary) 8%, transparent);
	}
	.admin-nav-item.active {
		opacity: 1;
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

	.admin-user {
		margin-top: 0.5rem;
		border-top: 1px solid var(--line-divider);
		padding-top: 0.85rem;
	}
	.admin-user-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0 0.75rem;
	}
	.admin-user-avatar {
		display: inline-block;
		width: 30px;
		height: 30px;
		border-radius: 999px;
		object-fit: contain;
		padding: 4px;
		background: linear-gradient(135deg, var(--primary), var(--title-active));
		flex-shrink: 0;
	}
	.admin-user-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--deep-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── 右侧主体（顶栏 + 内容） ── */
	.admin-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.admin-topbar {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.85rem 1.75rem;
		background: color-mix(in oklch, var(--page-bg) 82%, var(--card-bg));
		border-bottom: 1px solid var(--line-divider);
		position: sticky;
		top: 0;
		z-index: 40;
		backdrop-filter: blur(8px);
	}
	.admin-topbar-title h1 {
		margin: 0;
		font-size: 1.08rem;
		font-weight: 700;
		color: var(--deep-text);
	}
	.admin-topbar-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 0.6rem;
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

	.admin-main {
		flex: 1;
		padding: 1.6rem 1.75rem 2.5rem;
		min-width: 0;
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

	/* 移动端 */
	@media (max-width: 767px) {
		.admin-shell {
			overflow-x: hidden;
		}
		.admin-menu-toggle {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			font-size: 1.1rem;
			line-height: 1;
			flex-shrink: 0;
			background: var(--card-bg);
			border: 1px solid var(--line-divider);
			border-radius: 0.5rem;
			color: var(--deep-text);
			cursor: pointer;
		}
		.admin-sidebar {
			position: fixed;
			top: 0;
			left: 0;
			height: 100vh;
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
			padding: 0.7rem 0.9rem;
		}
		.admin-main {
			padding: 1rem 0.85rem 1.6rem;
		}
		.admin-topbar-title h1 {
			font-size: 1rem;
		}
	}
</style>
