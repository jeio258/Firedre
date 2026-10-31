<script lang="ts">
import { CATEGORIES } from "@/components/admin/adminSettingsSchema/types";
import { iconSvg, isActive, NAV_GROUPS } from "@/lib/adminNav";

interface Props {
	open: boolean;
	section: string;
	username: string;
	onClose: () => void;
}
let { open, section, username, onClose }: Props = $props();
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
				<a
					href="/admin/settings/"
					class="nav-item"
					class:active={section === "settings"}
				>
					<span class="nav-icon">{@html iconSvg("settings")}</span>
					<span class="nav-label">站点设置</span>
				</a>
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
