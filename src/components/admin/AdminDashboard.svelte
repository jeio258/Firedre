<script lang="ts">
	import { onMount } from "svelte";
	import { apiJson } from "@/lib/adminApi";
	import AdminAreaChart from "./charts/AdminAreaChart.svelte";
	import AdminDonutChart from "./charts/AdminDonutChart.svelte";
	import AdminBarChart from "./charts/AdminBarChart.svelte";

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
		statusDist?: { name: string; value: number }[];
		categoryDist?: { name: string; 文章数: number }[];
		topWords?: { slug: string; title: string; words: number; minutes: number }[];
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

	let stats: Stats = {};
	let loading = true;
	let loadError = "";

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
	const STATUS_COLORS: Record<string, string> = {
		已发布: "#10b981",
		草稿: "#94a3b8",
		未发布: "#f59e0b",
	};

	function fmtNum(n: number | undefined): string {
		return (n ?? 0).toLocaleString("zh-CN");
	}

	function fmtWords(n: number | undefined): string {
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

	const statusOf = (pinned: boolean, published: boolean): string =>
		published ? "published" : "draft";

	const toDate = (iso: string | undefined) =>
		new Date().toLocaleString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});

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

<div class="dash-page">
	<div class="dash-header">
		<div>
			<h2>{stats.siteTitle || "站点"} · 数据看板</h2>
			<p class="dash-sub">数据更新至 {toDate()}</p>
		</div>
		<a class="btn-secondary" href="/admin/posts/">管理文章</a>
	</div>

	{#if loading}
		<div class="dash-loading">加载中…</div>
	{:else if loadError}
		<div class="dash-error">{loadError}</div>
	{:else}
		<!-- 统计卡 -->
		<div class="stat-grid">
			<div class="dash-card stat-card">
				<div class="stat-main">
					<p class="stat-label">文章总数</p>
					<p class="stat-value">{fmtNum(stats.totals?.posts)}</p>
				</div>
				<span class="stat-icon tone-primary">{@html iconArticle}</span>
				<p class="stat-hint">
					已发布 {fmtNum(stats.totals?.published)} · 草稿 {fmtNum(stats.totals?.draft)}
				</p>
			</div>
			<div class="dash-card stat-card">
				<div class="stat-main">
					<p class="stat-label">动态总数</p>
					<p class="stat-value">{fmtNum(stats.totals?.dynamics)}</p>
				</div>
				<span class="stat-icon tone-violet">{@html iconSparkle}</span>
				<p class="stat-hint">类 memos 短内容</p>
			</div>
			<div class="dash-card stat-card">
				<div class="stat-main">
					<p class="stat-label">友链数量</p>
					<p class="stat-value">{fmtNum(stats.totals?.friends)}</p>
				</div>
				<span class="stat-icon tone-emerald">{@html iconUsers}</span>
				<p class="stat-hint">启用 {fmtNum(stats.totals?.friendsEnabled)}</p>
			</div>
			<div class="dash-card stat-card">
				<div class="stat-main">
					<p class="stat-label">标签 / 分类</p>
					<p class="stat-value">{fmtNum(stats.totals?.tags)} / {fmtNum(stats.totals?.categories)}</p>
				</div>
				<span class="stat-icon tone-amber">{@html iconTag}</span>
				<p class="stat-hint">内容组织维度</p>
			</div>
		</div>

		<!-- 趋势 + 状态 -->
		<div class="chart-row">
			<div class="dash-card span-2">
				<h3 class="chart-title">文章发布趋势</h3>
				<p class="chart-sub">按发布月份统计</p>
				<div class="chart-legend">
					<span><i style="background:{AREA_COLORS.发布}"></i>发布</span>
					<span><i style="background:{AREA_COLORS.草稿}"></i>草稿</span>
				</div>
				<AdminAreaChart data={stats.monthlyTrend || []} colors={AREA_COLORS} height={240} />
			</div>
			<div class="dash-card">
				<h3 class="chart-title">状态分布</h3>
				<p class="chart-sub">文章状态占比</p>
				<AdminDonutChart
					data={(stats.statusDist || []).map((s) => ({
						name: s.name,
						value: s.value,
						color: STATUS_COLORS[s.name] || "#8b5cf6",
					}))}
					size={172}
					thickness={20}
					centerSub="篇文章"
				/>
				<div class="donut-legend">
					{#each stats.statusDist || [] as s (s.name)}
						<span>
							<i style="background:{STATUS_COLORS[s.name] || '#8b5cf6'}"></i>
							{s.name} · {s.value}
						</span>
					{/each}
				</div>
			</div>
		</div>

		<!-- 分类分布 + 字数最多 -->
		<div class="chart-row">
			<div class="dash-card span-2">
				<h3 class="chart-title">分类分布</h3>
				<p class="chart-sub">各分类下的文章数量</p>
				<AdminBarChart
					data={(stats.categoryDist || []).map((c) => ({
						name: c.name,
						value: c.文章数,
					}))}
					height={220}
				/>
			</div>
			<div class="dash-card">
				<h3 class="chart-title">字数最多</h3>
				<p class="chart-sub">按正文字数排序</p>
				{#if (stats.topWords || []).length === 0}
					<p class="empty-tip">暂无已发布内容</p>
				{:else}
					<ul class="rank-list">
						{#each stats.topWords || [] as a, i (a.slug)}
							<li>
								<span class="rank-badge {i < 3 ? 'rank-' + (i + 1) : ''}">{i + 1}</span>
								<div class="rank-body">
									<a href="/admin/posts/edit/{a.slug}/">{a.title}</a>
									<p>{fmtWords(a.words)} 字 · {a.minutes || 0} 分钟阅读</p>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<!-- 最近更新 -->
		<div class="dash-card recent-card">
			<div class="recent-head">
				<div>
					<h3 class="chart-title">最近更新</h3>
					<p class="chart-sub">按最后修改时间排序</p>
				</div>
				<a class="more-link" href="/admin/posts/">查看全部</a>
			</div>
			{#if (stats.recent || []).length === 0}
				<p class="empty-tip">暂无内容</p>
			{:else}
				<ul class="recent-list">
					{#each stats.recent || [] as a (a.slug)}
						<li>
							<div class="recent-main">
								<a href="/admin/posts/edit/{a.slug}/">{a.title}</a>
								<p>
									{a.categories?.[0] || "未分类"}
									{#if a.tags?.length}· {a.tags.map((t) => `#${t}`).join(" ")}{:else} · 无标签{/if}
								</p>
							</div>
							<div class="recent-side">
								{#if a.pinned}<span class="badge amber">置顶</span>{/if}
								<span class="badge {statusOf(a.pinned, a.published)}">
									{a.published ? "已发布" : "草稿"}
								</span>
								<span class="recent-time">{fromNow(a.updated)}</span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.dash-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 1280px;
		margin: 0 auto;
	}
	.dash-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.dash-header h2 {
		margin: 0;
		font-size: 1.12rem;
		font-weight: 700;
		color: var(--deep-text);
	}
	.dash-sub {
		margin: 0.2rem 0 0;
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.dash-loading,
	.dash-error {
		padding: 3rem;
		text-align: center;
		color: var(--text-muted);
	}
	.dash-error {
		color: var(--danger);
	}

	.dash-card {
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		border-radius: 0.9rem;
		padding: 1.1rem 1.15rem;
	}

	/* 按钮 */
	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.42rem 0.9rem;
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: 0.55rem;
		border: 1px solid var(--line-divider);
		background: var(--card-bg);
		color: var(--deep-text);
		text-decoration: none;
		transition: border-color 0.14s, color 0.14s;
	}
	.btn-secondary:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	/* 统计卡 */
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}
	.stat-card {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		gap: 0.3rem 0.8rem;
	}
	.stat-main {
		min-width: 0;
	}
	.stat-label {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	.stat-value {
		margin: 0.2rem 0 0;
		font-size: 1.8rem;
		font-weight: 700;
		color: var(--deep-text);
		line-height: 1.1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.stat-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 0.6rem;
	}
	.stat-icon :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
	}
	.stat-hint {
		grid-column: 1 / -1;
		margin: 0.15rem 0 0;
		font-size: 0.72rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tone-primary {
		background: color-mix(in oklch, var(--primary) 14%, transparent);
		color: var(--primary);
	}
	.tone-violet {
		background: color-mix(in oklch, #8b5cf6 14%, transparent);
		color: #8b5cf6;
	}
	.tone-emerald {
		background: color-mix(in oklch, #10b981 14%, transparent);
		color: #10b981;
	}
	.tone-amber {
		background: color-mix(in oklch, #f59e0b 16%, transparent);
		color: #f59e0b;
	}

	/* 图表行 */
	.chart-row {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}
	.chart-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--deep-text);
	}
	.chart-sub {
		margin: 0.15rem 0 0;
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.chart-legend {
		display: flex;
		gap: 1rem;
		margin: 0.6rem 0 0.2rem;
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.chart-legend i,
	.donut-legend i {
		display: inline-block;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		margin-right: 0.3rem;
		vertical-align: middle;
	}
	.donut-legend {
		display: flex;
		justify-content: center;
		gap: 0.9rem;
		margin-top: 0.7rem;
		font-size: 0.78rem;
		color: var(--text-muted);
		flex-wrap: wrap;
	}
	.empty-tip {
		text-align: center;
		color: var(--text-muted);
		font-size: 0.85rem;
		padding: 1.5rem 0;
		margin: 0;
	}

	/* 字数最多 */
	.rank-list {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.rank-list li {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
	}
	.rank-badge {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 1px;
		border-radius: 0.3rem;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-muted);
		background: var(--btn-regular-bg);
	}
	.rank-badge.rank-1 {
		background: color-mix(in oklch, #f59e0b 22%, transparent);
		color: #d97706;
	}
	.rank-badge.rank-2 {
		background: var(--btn-regular-bg);
		color: #475569;
	}
	.rank-badge.rank-3 {
		background: color-mix(in oklch, #ea580c 18%, transparent);
		color: #c2410c;
	}
	.rank-body {
		min-width: 0;
		flex: 1;
	}
	.rank-body a {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: 0.88rem;
		color: var(--deep-text);
		text-decoration: none;
		line-height: 1.35;
	}
	.rank-body a:hover {
		color: var(--primary);
	}
	.rank-body p {
		margin: 0.1rem 0 0;
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	/* 最近更新 */
	.recent-card {
		padding: 0;
		overflow: hidden;
	}
	.recent-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.1rem 1.15rem;
		border-bottom: 1px solid var(--line-divider);
	}
	.more-link {
		font-size: 0.82rem;
		color: var(--primary);
		text-decoration: none;
	}
	.more-link:hover {
		text-decoration: underline;
	}
	.recent-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.recent-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		padding: 0.7rem 1.15rem;
		border-bottom: 1px solid var(--line-divider);
	}
	.recent-list li:last-child {
		border-bottom: none;
	}
	.recent-list li:hover {
		background: var(--btn-regular-bg);
	}
	.recent-main {
		min-width: 0;
		flex: 1;
	}
	.recent-main a {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--deep-text);
		text-decoration: none;
	}
	.recent-main a:hover {
		color: var(--primary);
	}
	.recent-main p {
		margin: 0.15rem 0 0;
		font-size: 0.74rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.recent-side {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 600;
	}
	.badge.amber {
		background: color-mix(in oklch, #f59e0b 16%, transparent);
		color: #b45309;
	}
	.badge.published {
		background: color-mix(in oklch, #10b981 16%, transparent);
		color: #059669;
	}
	.badge.draft {
		background: var(--btn-regular-bg);
		color: var(--text-muted);
	}
	.recent-time {
		font-size: 0.75rem;
		color: var(--text-muted);
		width: 5.2rem;
		text-align: right;
	}

	@media (min-width: 768px) {
		.stat-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}
	@media (min-width: 1200px) {
		.chart-row {
			grid-template-columns: 2fr 1fr;
		}
	}
</style>
