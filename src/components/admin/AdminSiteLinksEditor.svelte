<script lang="ts">
	import { onMount } from "svelte";
	import { apiJson } from "@/lib/adminApi";
	import AdminCrudEditor, { type CrudField } from "./AdminCrudEditor.svelte";

	type SiteLinkItem = {
		id: number;
		name: string;
		url: string;
		icon: string;
		location: "navbar" | "footer" | "profile" | "sponsor";
		kind?: "link" | "qr";
		enabled: boolean;
		sortOrder?: number;
	};

	const LOCATION_LABELS: Record<SiteLinkItem["location"], string> = {
		navbar: "导航栏「链接」下拉",
		footer: "页脚 Powered by",
		profile: "侧栏资料卡",
		sponsor: "打赏方式（二维码/跳转）",
	};

	const fields: CrudField[] = [
		{ key: "name", label: "名称 *", type: "text", placeholder: "如：GitHub", required: true },
		{ key: "url", label: "链接地址 *", type: "text", placeholder: "https://github.com/you", required: true },
		{ key: "icon", label: "图标（Iconify 名称，可选）", type: "text", placeholder: "fa7-brands:github" },
		{
			key: "location",
			label: "展示位置 *",
			type: "select",
			options: (Object.keys(LOCATION_LABELS) as SiteLinkItem["location"][]).map((v) => ({
				value: v,
				label: LOCATION_LABELS[v],
			})),
			required: true,
		},
		{
			key: "kind",
			label: "类型（打赏方式时用）",
			type: "select",
			options: [
				{ value: "link", label: "跳转链接（外链/前往打赏）" },
				{ value: "qr", label: "二维码图片（收款码）" },
			],
		},
		{ key: "sortOrder", label: "排序（同位置从小到大）", type: "number", toPayload: (v) => Number(v) || 0 },
		{ key: "enabled", label: "启用（显示在前台对应位置）", type: "checkbox" },
	];

	// 站点主域名
	let siteUrl = "";
	let siteUrlSaving = false;
	let siteUrlMsg = "";

	async function loadSiteUrl() {
		try {
			const settings = await apiJson<Record<string, unknown>>("/api/settings/?group=basic");
			siteUrl = String((settings as { siteUrl?: unknown }).siteUrl ?? "");
		} catch {
			// 域名加载失败不影响链接列表
		}
	}

	async function saveSiteUrl() {
		const val = siteUrl.trim();
		if (!val) {
			siteUrlMsg = "域名不能为空";
			return;
		}
		siteUrlSaving = true;
		siteUrlMsg = "";
		try {
			const resp = await fetch("/api/settings/", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ groups: { basic: { siteUrl: val } } }),
			});
			const data = await resp.json();
			if (!resp.ok || !data.ok) {
				siteUrlMsg = data.message || "保存失败";
				return;
			}
			siteUrlMsg = "域名已保存 ✓";
		} catch {
			siteUrlMsg = "网络错误";
		} finally {
			siteUrlSaving = false;
		}
	}

	onMount(loadSiteUrl);
</script>

<AdminCrudEditor
	apiPath="/api/site-links/"
	title="链接管理"
	addLabel="+ 添加链接"
	entityName="链接"
	{fields}
	identify={(item) => String(item.name ?? "")}
>
	{#snippet extraBlock()}

		<div class="site-url-block">
			<div class="site-url-head">
				<span>站点主域名</span>
				<button class="btn-ghost" on:click={saveSiteUrl} disabled={siteUrlSaving}>
					{siteUrlSaving ? "保存中…" : "保存域名"}
				</button>
			</div>
			<input type="text" placeholder="https://example.com" bind:value={siteUrl} />
			{#if siteUrlMsg}
				<span class="url-msg">{siteUrlMsg}</span>
			{/if}
		</div>
	{/snippet}
	{#snippet children({ item })}
		<div class="link-info">
			<div class="link-name">
				{item.name}
				{#if !item.enabled}
					<span class="u-chip off">未启用</span>
				{/if}
			</div>
			<div class="link-loc">
				{LOCATION_LABELS[item.location]}
				{#if item.location === "sponsor"}
					{item.kind === "qr" ? " · 二维码" : " · 跳转"}
				{/if}
			</div>
			<div class="link-url">{item.url}</div>
			{#if item.icon}
				<div class="link-icon">{item.icon}</div>
			{/if}
		</div>
	{/snippet}
</AdminCrudEditor>

<style>
	.site-url-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.9rem 1rem 1rem;
		margin-bottom: 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		border-radius: 0.8rem;
	}
	.site-url-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--deep-text);
	}
	.site-url-block input {
		padding: 0.48rem 0.65rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--deep-text);
		font-size: 0.88rem;
	}
	.site-url-head button {
		padding: 0.34rem 0.8rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--deep-text);
		font-size: 0.82rem;
		cursor: pointer;
	}
	.site-url-head button:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
	.site-url-head button:disabled {
		opacity: 0.6;
	}
	.url-msg {
		font-size: 0.8rem;
		color: var(--success);
	}

	.u-chip.off {
		background: var(--btn-regular-bg);
		color: var(--text-muted);
	}
	.link-info {
		min-width: 0;
	}
	.link-name {
		font-weight: 600;
		font-size: 0.95rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--deep-text);
	}
	.link-loc {
		font-size: 0.78rem;
		color: var(--primary);
	}
	.link-url {
		font-size: 0.78rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 460px;
	}
	.link-icon {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
</style>
