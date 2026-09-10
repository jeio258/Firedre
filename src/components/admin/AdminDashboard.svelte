<script lang="ts">
	import { onMount } from "svelte";
	import { apiJson } from "@/lib/adminApi";
	import AdminAreaChart from "./charts/AdminAreaChart.svelte";

	interface Stats {
		siteTitle?: string;
		totals?: {
			posts: number;
			published: number;
			draft: number;
			words: number;
			dynamics: number;
			friends: number;
			friendsEnabled: number;
			tags: number;
			categories: number;
			albums: number;
		};
		monthlyTrend?: { label: string; 发布: number; 草稿: number }[];
		recent?: {
			slug: string;
			title: string;
			categories: string[];
			tags: string[];
			published: boolean;
			pinned: boolean;
			updated: string;
		}[];
	}

	let stats = $state<Stats>({});
	let loading = $state(true);
	let loadError = $state("");

	const S = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">`;
	const iconArticle =
		S +
		'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>';
	const iconSparkle =
		S +
		'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
	const iconUsers =
		S +
		'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
	const iconTag =
		S +
		'<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></svg>';

	const AREA_COLORS = { 发布: "#0f766e", 草稿: "#0ea5e9" };

	function fmtNum(n: number | undefined): string {
		return (n ?? 0).toLocaleString("zh-CN");
	}

	function fromNow(iso: string | undefined): string {
		if (!iso) return "";
		const t = new Date(iso).getTime();
		if (Number.isNaN(t)) return "";
		const diff = Date.now() - t;
		const m = Math.floor(diff / 60000);
		if (m < 1) return "刚刚";
		if (m < 60) return `${m} 分钟前`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h} 小时前`;
		const d = Math.floor(h / 24);
		if (d < 30) return `${d} 天前`;
		return new Date(t).toLocaleDateString("zh-CN");
	}

	function gotoEditor(slug: string) {
		window.history.pushState({}, "", `/admin/posts/edit/${encodeURIComponent(slug)}/`);
		window.dispatchEvent(new PopStateEvent("popstate"));
	}

	onMount(async () => {
		try {
			stats = await apiJson<Stats>("/api/admin/stats/");
		} catch (e) {
			loadError = e instanceof Error ? e.message : "统计加载失败";
		} finally {
			loading = false;
		}
	});
</script>

<div class="crud-page">
	<div class="crud-head">
		<div>
			<h2>{stats.siteTitle || "站点"} · 数据看板</h2>
			<p class="crud-sub">数据更新至刚刚</p>
		</div>
		<div class="crud-head-actions">
			<a class="btn btn-primary" href="/admin/posts/">管理文章</a>
		</div>
	</div>

	{#if loading}
		<div class="crud-empty">加载中…</div>
	{:else if loadError}
		<div class="crud-empty" style="color:var(--danger)">{loadError}</div>
	{:else}
		<div class="stat-grid">
			<div class="card stat-card">
				<span class="stat-icon" style="background:color-mix(in oklch,var(--primary) 15%,transparent);color:var(--primary)">{@html iconArticle}</span>
				<p class="stat-label">文章总数</p>
				<p class="stat-value">{fmtNum(stats.totals?.posts)}</p>
			</div>
			<div class="card stat-card">
				<span class="stat-icon" style="background:color-mix(in oklch,#7c3aed 15%,transparent);color:#7c3aed">{@html iconSparkle}</span>
				<p class="stat-label">动态总数</p>
				<p class="stat-value">{fmtNum(stats.totals?.dynamics)}</p>
			</div>
			<div class="card stat-card">
				<span class="stat-icon" style="background:color-mix(in oklch,#059669 15%,transparent);color:#059669">{@html iconUsers}</span>
				<p class="stat-label">友链数量</p>
				<p class="stat-value">{fmtNum(stats.totals?.friends)}</p>
			</div>
			<div class="card stat-card">
				<span class="stat-icon" style="background:color-mix(in oklch,#d97706 15%,transparent);color:#d97706">{@html iconTag}</span>
				<p class="stat-label">标签 / 分类</p>
				<p class="stat-value">{fmtNum(stats.totals?.tags)} / {fmtNum(stats.totals?.categories)}</p>
			</div>
		</div>

		<div class="dash-cols">
			<div class="card">
				<h3 class="panel-title">文章发布趋势</h3>
				<p class="crud-sub">按发布月份统计</p>
				<AdminAreaChart data={stats.monthlyTrend || []} colors={AREA_COLORS} height={200} />
			</div>
			<div class="card">
				<h3 class="panel-title">最近更新</h3>
				{#if (stats.recent || []).length === 0}
					<p class="crud-sub" style="margin-top:.6rem">暂无内容</p>
				{:else}
					{#each stats.recent || [] as a (a.slug)}
						<div class="list-row clickable" role="button" tabindex="0" onclick={() => gotoEditor(a.slug)} onkeydown={(e) => e.key === "Enter" && gotoEditor(a.slug)}>
							<div class="list-main">
								<div class="list-title">{a.title}</div>
								<div class="list-sub">{fromNow(a.updated)} · {a.categories?.[0] || "未分类"}</div>
							</div>
							<span class="u-chip {a.published ? 'ok' : 'off'}">{a.published ? "已发布" : "草稿"}</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
