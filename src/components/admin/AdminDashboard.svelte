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
	window.history.pushState(
		{},
		"",
		`/admin/posts/edit/${encodeURIComponent(slug)}/`,
	);
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

<div class="ui-page">
	<div class="ui-head">
		<div>
			<h2 class="ui-title">数据看板</h2>
			<p class="ui-sub">数据更新至刚刚</p>
		</div>
		<div class="ui-acts">
			<a class="ui-btn ui-btn-primary" href="/admin/posts/">管理文章</a>
		</div>
	</div>

	{#if loading}
		<div class="ui-card">
			<div class="ui-empty">加载中…</div>
		</div>
	{:else if loadError}
		<div class="ui-card">
			<div class="ui-empty">{loadError}</div>
		</div>
	{:else}
		<div class="ui-grid-4">
			<div class="ui-card">
				<div class="ui-card-b">
					<p class="ui-sub">文章总数</p>
					<p class="ui-title">{fmtNum(stats.totals?.posts)}</p>
				</div>
			</div>
			<div class="ui-card">
				<div class="ui-card-b">
					<p class="ui-sub">动态总数</p>
					<p class="ui-title">{fmtNum(stats.totals?.dynamics)}</p>
				</div>
			</div>
			<div class="ui-card">
				<div class="ui-card-b">
					<p class="ui-sub">友链数量</p>
					<p class="ui-title">{fmtNum(stats.totals?.friends)}</p>
				</div>
			</div>
			<div class="ui-card">
				<div class="ui-card-b">
					<p class="ui-sub">标签 / 分类</p>
					<p class="ui-title">{fmtNum(stats.totals?.tags)} / {fmtNum(stats.totals?.categories)}</p>
				</div>
			</div>
		</div>

		<div class="ui-card">
			<div class="ui-card-h">
				文章发布趋势
				<span class="ui-sub">按发布月份统计</span>
			</div>
			<div class="ui-card-b">
				<AdminAreaChart
					data={stats.monthlyTrend || []}
					colors={AREA_COLORS}
					height={200}
				/>
			</div>
		</div>

		<div class="ui-card">
			<div class="ui-card-h">最近更新</div>
			{#if (stats.recent || []).length === 0}
				<div class="ui-empty">暂无内容</div>
			{:else}
				<table class="ui-table">
					<tbody>
						{#each stats.recent || [] as a (a.slug)}
							<tr
								class="clickable"
								role="button"
								tabindex="0"
								onclick={() => gotoEditor(a.slug)}
								onkeydown={(e) => e.key === "Enter" && gotoEditor(a.slug)}
							>
								<td>
									<div>{a.title}</div>
									<div class="ui-sub">
										<time datetime={a.updated}>{fromNow(a.updated)}</time>
										· {a.categories?.[0] || "未分类"}
									</div>
								</td>
								<td>
									<span class="ui-badge">{a.published ? "已发布" : "草稿"}</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</div>

<style>
	.clickable {
		cursor: pointer;
	}
</style>
