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

	.sidebar .brand-logo {
		width: 1.9rem;
		height: 1.9rem;
		padding: 3px;
		border-radius: 0.55rem;
		object-fit: contain;
		flex-shrink: 0;
		background: var(--btn-regular-bg);
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

	.sidebar .user {
		padding: 0.4rem 0.55rem 0.1rem;
	}

	.sidebar .avatar {
		width: 1.75rem;
		height: 1.75rem;
		background: var(--btn-regular-bg);
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
	}</style>
