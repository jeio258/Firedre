<script lang="ts">
import { CATEGORIES } from "@/components/admin/adminSettingsSchema/types";
import { iconSvg, isActive, NAV_GROUPS } from "@/lib/adminNav";

interface Props {
	open: boolean;
	section: string;
	settingsCat: number;
	s3open: boolean;
	username: string;
	onClose: () => void;
	onToggleS3: () => void;
	onGoSettings: (ci: number) => void;
}
let {
	open,
	section,
	settingsCat,
	s3open,
	username,
	onClose,
	onToggleS3,
	onGoSettings,
}: Props = $props();
</script>

<aside class="sidebar" class:open={open}>
	<div class="brand">
		<img class="brand-logo" src="/favicon/firefly-32.png" alt="Firedre" />
		<span class="brand-text">Firedre</span>
		<button class="menu-close" aria-label="关闭菜单" onclick={onClose}>
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
							onclick={() => {	onToggleS3();
								if (section !== "settings") onGoSettings(0);
							}}
						>
							<span class="nav-icon">{@html iconSvg("settings")}</span>
							<span class="nav-label">站点设置</span>
							<span class="s3caret">{@html iconSvg("chevron")}</span>
						</a>
						<div class="s3sub">
							{#each CATEGORIES as label, ci}
								<button
									type="button"
									class="s3cat"
									class:on={section === "settings" && settingsCat === ci}
									onclick={() => onGoSettings(ci)}
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
							class:active={isActive(item, section)}
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

<style>
	.sidebar {
		width: 248px;
		background: var(--card-bg);
		border-right: 1px solid var(--line-color);
	}

	.sidebar .brand {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 1rem 0.85rem 0.85rem;
		border-bottom: 1px solid var(--line-color);
	}

	.sidebar .brand-logo {
		width: 1.9rem;
		height: 1.9rem;
		padding: 3px;
		border-radius: 0.55rem;
		object-fit: contain;
		flex-shrink: 0;
		background: var(--btn-regular-bg);
	}

	.sidebar .brand-text {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		color: var(--deep-text);
	}

	.sidebar .menu-close {
		margin-left: auto;
		color: var(--text-muted);
		border-radius: 0.55rem;
	}

	.sidebar .menu-close:hover {
		background: var(--btn-regular-bg);
		color: var(--deep-text);
	}

	.sidebar .nav {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.75rem 0.6rem 0.9rem;
	}

	.sidebar .nav-group {
		margin-bottom: 1.15rem;
	}

	.sidebar .nav-group:last-child {
		margin-bottom: 0;
	}

	.sidebar .nav-title {
		margin: 0 0 0.4rem;
		padding: 0 0.55rem;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.sidebar .nav-item {
		gap: 0.6rem;
		padding: 0.5rem 0.6rem;
		border-radius: 0.55rem;
		font-size: 0.875rem;
		color: var(--deep-text);
		transform: none;
	}

	.sidebar .nav-item:hover {
		background: color-mix(in srgb, var(--btn-regular-bg) 65%, transparent);
		color: var(--deep-text);
		transform: none;
	}

	.sidebar .nav-icon {
		display: inline-flex;
		align-items: center;
		color: var(--text-muted);
	}

	.sidebar .nav-item:hover .nav-icon,
	.sidebar .nav-item.active .nav-icon {
		color: var(--primary-text);
	}

	.sidebar .nav-item.active {
		background: var(--btn-regular-bg);
		color: var(--primary-text);
		font-weight: 600;
		box-shadow: none;
	}

	.sidebar .nav-item.active::before {
		left: -0.35rem;
		width: 3px;
		height: 1rem;
		background: var(--primary-fill);
	}

	.sidebar .s3parent {
		cursor: pointer;
		user-select: none;
	}

	.sidebar .s3caret {
		color: var(--text-muted);
	}

	.sidebar .s3sub {
		border-left: 1px solid var(--line-color);
	}

	.sidebar .s3cat {
		padding: 0.42rem 0.55rem;
		border-radius: 0.45rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.sidebar .s3cat:hover {
		background: color-mix(in srgb, var(--btn-regular-bg) 65%, transparent);
		color: var(--deep-text);
	}

	.sidebar .s3cat.on {
		background: var(--btn-regular-bg);
		color: var(--primary-text);
		font-weight: 600;
	}

	.sidebar .side-foot {
		flex-shrink: 0;
		padding: 0.55rem 0.6rem 0.7rem;
		border-top: 1px solid var(--line-color);
	}

	.sidebar .side-foot .site-link {
		gap: 0.6rem;
		padding: 0.45rem 0.55rem;
		border-radius: 0.5rem;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.sidebar .side-foot .site-link:hover {
		background: var(--btn-regular-bg);
		color: var(--primary-text);
	}

	.sidebar .user {
		padding: 0.4rem 0.55rem 0.1rem;
	}

	.sidebar .avatar {
		width: 1.75rem;
		height: 1.75rem;
		background: var(--btn-regular-bg);
	}

	.sidebar .user-name {
		font-size: 0.82rem;
	}

	.sidebar .user-role {
		font-size: 0.72rem;
	}

	@media (max-width: 900px) {
		.sidebar {
			position: fixed;
			top: 0;
			left: 0;
			width: min(248px, 84vw);
			height: 100dvh;
			transform: translateX(-100%);
			transition: transform 0.24s var(--ease-standard);
			z-index: 50;
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.sidebar .menu-close {
			display: inline-flex;
		}

		:global(.shell.collapsed) .sidebar {
			width: min(248px, 84vw);
		}

		:global(.shell.collapsed) .sidebar .nav-label,
		:global(.shell.collapsed) .sidebar .nav-title,
		:global(.shell.collapsed) .sidebar .brand-text {
			display: initial;
		}

		:global(.shell.collapsed) .sidebar .user-meta {
			display: flex;
		}

		:global(.shell.collapsed) .sidebar .nav-item,
		:global(.shell.collapsed) .sidebar .user {
			justify-content: flex-start;
			gap: 0.6rem;
		}

		:global(.shell.collapsed) .sidebar .nav-item.active::before {
			left: -0.6rem;
		}
	}

	@media (min-width: 768px) and (max-width: 900px) {
		:global(.backdrop.open) {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 45;
			background: color-mix(in srgb, var(--deep-text) 40%, transparent);
		}
	}
</style>
