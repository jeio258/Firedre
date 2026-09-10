<script lang="ts">
	import { onMount } from "svelte";
	import AdminLogin from "./AdminLogin.svelte";
	import AdminThemeSwitch from "./AdminThemeSwitch.svelte";
	import { persistActiveDraft, runSaveAll } from "@/lib/adminSave";

	type Section = string;

	let authed = false;
	let checking = true;
	let username = "";
	let checkFailed = false;
	let section: Section = "dashboard";
	let sidebarOpen = false;
	let View: unknown = null;
	let viewProps: Record<string, unknown> = {};
	let viewError = "";
	let viewKey = "dashboard";

	let userMenuOpen = false;
	let pwdPanelOpen = false;
	let newPassword = "";
	let pwdMsg = "";
	let pwdError = "";
	let pwdSaving = false;

	let collapsed = false;
	let s3open = false;
	let settingsCat = 0;

	interface NavItem {
		label: string;
		href: string;
		icon: string;
		sections: string[];
	}
	const NAV_GROUPS: { title: string; items: NavItem[]; settings?: boolean }[] = [
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
			settings: true,
			items: [
				{ label: "站点设置", href: "/admin/settings/", icon: "settings", sections: ["settings"] },
			],
		},
	];
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
	const SECTION_GROUPS: Record<string, string> = {
		dashboard: "内容管理",
		posts: "内容管理",
		"posts-edit": "内容管理",
		new: "内容管理",
		links: "站点模块",
		sitelinks: "站点模块",
		notice: "站点模块",
		dynamics: "站点模块",
		about: "站点模块",
		gallery: "站点模块",
		"album-edit": "站点模块",
		settings: "系统",
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
		menu: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
		close: '<path d="M18 6 6 18M6 6l12 12"/>',
		external:
			'<path d="M14 3h7v7"/><path d="m21 3-9 9"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
		theme: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/>',
		save:
			'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
		chevron: '<path d="M6 9l6 6 6-6"/>',
	};
	function icon(name: string): string {
		return ICONS[name] || ICONS.settings;
	}
	function iconSvg(name: string, cls = ""): string {
		return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">${icon(name)}</svg>`;
	}

	function isActive(item: NavItem): boolean {
		return item.sections.includes(section);
	}
	function title(): string {
		return SECTION_TITLES[section] || "后台";
	}
	function groupTitle(): string {
		return SECTION_GROUPS[section] || "";
	}

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
		const n = Number.parseInt(v);
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
		if (["dashboard", "links", "sitelinks", "dynamics", "notice", "about", "settings"].includes(first)) {
			return { section: first };
		}
		return { section: "dashboard" };
	}

	async function render(s: Section, slug?: string) {
		persistActiveDraft();
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
		if (!href || !href.startsWith("/admin/")) return;
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

	function logout() {
		fetch("/api/admin/logout/", { method: "POST", credentials: "include" }).finally(
			() => window.location.replace("/admin/"),
		);
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

	let saveToast = "";
	let saveToastKind: "ok" | "err" = "ok";
	let saveToastTimer: ReturnType<typeof setTimeout> | null = null;
	function showToast(msg: string, kind: "ok" | "err" = "ok") {
		saveToast = msg;
		saveToastKind = kind;
		if (saveToastTimer) clearTimeout(saveToastTimer);
		saveToastTimer = setTimeout(() => (saveToast = ""), 2600);
	}

	async function saveAll() {
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
		window.addEventListener("popstate", () => navigate(window.location.pathname));
		return () => {
			document.removeEventListener("click", handleNav);
			window.removeEventListener("popstate", () => navigate(window.location.pathname));
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
			<div class="backdrop open" on:click={() => (sidebarOpen = false)}></div>
		{/if}

		<aside class="sidebar" class:open={sidebarOpen}>
			<div class="brand">
				<img class="brand-logo" src="/favicon/firefly-32.png" alt="Firedre" />
				<span class="brand-text">Firedre</span>
				<button class="menu-close" aria-label="关闭菜单" on:click={() => (sidebarOpen = false)}>
					{@html iconSvg("close")}
				</button>
			</div>

			<nav class="nav">
				{#each NAV_GROUPS as group (group.title)}
					<div class="nav-group">
						<p class="nav-title">{group.title}</p>
						{#if group.settings}
							<div class="s3wrap" class:open={s3open && section === "settings"}>
								<a
									href="/admin/settings/"
									class="nav-item s3parent"
									class:active={section === "settings"}
									on:click={() => {
										toggleS3();
										if (section !== "settings") goSettings(0);
									}}
								>
									<span class="nav-icon">{@html iconSvg("settings")}</span>
									<span class="nav-label">站点设置</span>
									<span class="s3caret">{@html iconSvg("chevron")}</span>
								</a>
								<div class="s3sub">
									{#each ["站点配置", "功能配置", "页面配置", "扩展功能"] as label, ci}
										<button
											type="button"
											class="s3cat"
											class:on={section === "settings" && settingsCat === ci}
											on:click={() => goSettings(ci)}
										>
											{label}
										</button>
									{/each}
								</div>
							</div>
						{:else}
							{#each group.items as item (item.href)}
								<a
									href={item.href}
									class="nav-item"
									class:active={isActive(item)}
								>
									<span class="nav-icon">{@html iconSvg(item.icon)}</span>
									<span class="nav-label">{item.label}</span>
								</a>
							{/each}
						{/if}
					</div>
				{/each}
			</nav>

			<div class="side-foot">
				<a class="site-link" href="/" target="_blank" rel="noopener">
					<span class="nav-icon">{@html iconSvg("external")}</span>
					<span class="nav-label">查看站点</span>
				</a>
				<div class="user">
					<img class="avatar" src="/favicon/firefly-32.png" alt="" />
					<div class="user-meta">
						<span class="user-name">{username || "admin"}</span>
						<span class="user-role">管理员</span>
					</div>
				</div>
			</div>
		</aside>

		<div class="body">
			<header class="topbar">
				<button class="menu-toggle" aria-label="菜单" on:click={toggleSidebar}>
					{@html iconSvg("menu")}
				</button>
				<div class="crumb">
					<span class="crumb-group">{groupTitle()}</span>
					<span class="crumb-sep">/</span>
					<h1 class="crumb-page">{title()}</h1>
				</div>
				<div class="top-actions">
					<button class="btn btn-primary" on:click={saveAll}>
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
						<button class="user-trigger" on:click={() => (userMenuOpen = !userMenuOpen)} aria-expanded={userMenuOpen}>
							<img class="avatar" src="/favicon/firefly-32.png" alt="" />
							<span class="user-name">{username || "admin"}</span>
							<span class="caret">▾</span>
						</button>
						{#if userMenuOpen}
							<div class="dropdown open">
								<button class="dd-item" on:click={togglePwdPanel}>
									{@html iconSvg("settings")} 修改密码
								</button>
								<button class="dd-item danger" on:click={logout}>
									{@html iconSvg("logout")} 退出登录
								</button>
								{#if pwdPanelOpen}
									<div class="pwd-panel open" on:click|stopPropagation>
										<p class="pwd-current">当前管理员：{username || "—"}</p>
										{#if pwdMsg}<p class="pwd-msg ok">{pwdMsg}</p>{/if}
										{#if pwdError}<p class="pwd-msg err">{pwdError}</p>{/if}
										<input
											type="password"
											placeholder="新密码（至少 8 位）"
											bind:value={newPassword}
											autocomplete="new-password"
										/>
										<button class="btn btn-primary" on:click={changePassword} disabled={pwdSaving}>
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
						<svelte:component this={View} {...viewProps} />
					{:else}
						<div class="admin-loading">加载中…</div>
					{/if}
				</main>
			</div>
		</div>
	</div>
{/if}
