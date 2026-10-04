<script lang="ts">
import ClientPagination from "@components/common/ClientPagination.svelte";
import { onMount } from "svelte";
import TabNav from "@/components/common/TabNav.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type { StandardizedAnime } from "@/types/bilibili";

import BilibiliCard from "./BilibiliCard.svelte";
import BilibiliDetailModal from "./BilibiliDetailModal.svelte";
import { getSeasonTypeLabel } from "./seasonTypes";

interface Props {
	// uid 入参：数据由客户端经 /api/bilibili 同源代理拉取（带边缘缓存+限流），
	// SSR 不再阻塞在第三方请求上（原为页面 SSR 直连 B 站 API）
	uid: string;
	itemsPerPage?: number;
}

let { uid, itemsPerPage = 24 }: Props = $props();

let items = $state<StandardizedAnime[]>([]);
let loading = $state(true);
let failed = $state(false);

let searchQuery = $state("");
let activeFilter = $state("");
let sortBy = $state<"rating-desc" | "rating-asc" | "date-desc" | "date-asc">(
	"rating-desc",
);
let currentPage = $state(1);
let selectedAnime = $state<StandardizedAnime | null>(null);

onMount(() => {
	if (!uid) {
		loading = false;
		return;
	}
	let cancelled = false;
	fetch(`/api/bilibili/?uid=${encodeURIComponent(uid)}`)
		.then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		})
		.then((data) => {
			if (cancelled) return;
			items = Array.isArray(data) ? data : [];
			loading = false;
			// 与原先 SSR 初始化一致：默认筛第一个 season_type
			activeFilter = String(
				[...new Set(items.map((i) => i.season_type || 1))].sort(
					(a, b) => a - b,
				)[0] || "",
			);
		})
		.catch(() => {
			if (!cancelled) {
				failed = true;
				loading = false;
			}
		});
	return () => {
		cancelled = true;
	};
});

let totalCount = $derived(items.length);
let averageRating = $derived(
	items.length > 0
		? (
				items.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) /
				items.length
			).toFixed(1)
		: "0.0",
);

// 动态生成筛选项：从数据中提取实际存在的 season_type
let filterOptions = $derived(() => {
	const typeMap = new Map<number, number>();
	for (const item of items) {
		const st = item.season_type || 1;
		typeMap.set(st, (typeMap.get(st) || 0) + 1);
	}
	return Array.from(typeMap.entries())
		.sort(([a], [b]) => a - b)
		.map(([type, count]) => ({
			value: String(type),
			label: getSeasonTypeLabel(type),
			count,
		}));
});

let filteredItems = $derived(() => {
	let result = [...items];

	if (searchQuery.trim()) {
		const query = searchQuery.trim().toLowerCase();
		result = result.filter(
			(item) =>
				item.title.toLowerCase().includes(query) ||
				item.originalTitle.toLowerCase().includes(query),
		);
	}

	if (activeFilter) {
		const filterType = Number(activeFilter);
		result = result.filter((item) => (item.season_type || 1) === filterType);
	}

	switch (sortBy) {
		case "rating-desc":
			result.sort((a, b) => b.rating - a.rating);
			break;
		case "rating-asc":
			result.sort((a, b) => a.rating - b.rating);
			break;
		case "date-desc":
			result.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
			break;
		case "date-asc":
			result.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
			break;
	}

	return result;
});

let pagedItems = $derived(() => {
	const start = (currentPage - 1) * itemsPerPage;
	return filteredItems().slice(start, start + itemsPerPage);
});

function resetPage() {
	currentPage = 1;
}

function handleSearch(e: Event) {
	searchQuery = (e.target as HTMLInputElement).value;
	resetPage();
}

function setFilter(filter: string) {
	activeFilter = activeFilter === filter ? "" : filter;
	resetPage();
}

function setSort(sort: typeof sortBy) {
	sortBy = sort;
	resetPage();
}

function goToPage(page: number) {
	currentPage = page;
}

function openDetail(anime: StandardizedAnime) {
	selectedAnime = anime;
}

function closeDetail() {
	selectedAnime = null;
}
</script>

<div class="media-list">
	{#if loading}
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
			{#each Array(10) as _, i (i)}
				<div class="aspect-[3/4] rounded-xl bg-(--btn-regular-bg) animate-pulse"></div>
			{/each}
		</div>
	{:else if failed || items.length === 0}
		<div class="py-16 text-center">
			<svg class="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<p class="text-50">{i18n(I18nKey.animeNoResults)}</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
			<div class="bg-(--card-bg) rounded-xl p-3 sm:p-4 border border-(--line-divider)">
				<div class="flex items-center gap-2 sm:gap-3">
					<div class="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-(--primary)/10 flex items-center justify-center shrink-0">
						<svg viewBox="0 0 24 24" class="w-4 h-4 sm:w-5 sm:h-5 text-(--primary)" fill="currentColor"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4h-4z"/></svg>
					</div>
					<div class="min-w-0">
						<div class="text-[10px] sm:text-xs text-50">{i18n(I18nKey.animeTotal)}</div>
						<div class="text-lg sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">{totalCount}</div>
					</div>
				</div>
			</div>
			<div class="bg-(--card-bg) rounded-xl p-3 sm:p-4 border border-(--line-divider)">
				<div class="flex items-center gap-2 sm:gap-3">
					<div class="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
						<svg viewBox="0 0 24 24" class="w-4 h-4 sm:w-5 sm:h-5 text-pink-500" fill="currentColor"><path d="M12 21s-8-4.35-8-10a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 5.65-8 10-8 10z"/></svg>
					</div>
					<div class="min-w-0">
						<div class="text-[10px] sm:text-xs text-50">{i18n(I18nKey.animeBilibiliAvg)}</div>
						<div class="text-lg sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">{averageRating}</div>
					</div>
				</div>
			</div>
		</div>

		<div class="mb-6 flex flex-col gap-3">
			<div class="flex gap-2">
				<div class="relative flex-1">
					<svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						placeholder={i18n(I18nKey.animeSearch)}
						value={searchQuery}
						oninput={handleSearch}
						class="w-full rounded-xl border border-(--line-divider) bg-(--card-bg) py-2.5 pl-10 pr-4 text-[16px] md:text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none transition-colors focus:border-(--primary)"
					/>
				</div>
				<select
					value={sortBy}
					onchange={(e) => setSort((e.target as HTMLSelectElement).value as typeof sortBy)}
					class="rounded-xl border border-(--line-divider) bg-(--card-bg) px-3 text-[16px] md:text-sm text-neutral-600 dark:text-neutral-400 outline-none cursor-pointer shrink-0"
				>
					<option value="rating-desc">{i18n(I18nKey.animeRatingDesc)}</option>
					<option value="rating-asc">{i18n(I18nKey.animeRatingAsc)}</option>
					<option value="date-desc">{i18n(I18nKey.animeDateDesc)}</option>
					<option value="date-asc">{i18n(I18nKey.animeDateAsc)}</option>
				</select>
			</div>

			<TabNav
				tabs={filterOptions().map(opt => ({ id: opt.value, name: opt.label, count: opt.count }))}
				activeTab={activeFilter}
				onTabChange={setFilter}
			/>
		</div>

		{#if pagedItems().length > 0}
			<div class="media-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
				{#each pagedItems() as anime (anime.id)}
					<BilibiliCard {anime} onclick={openDetail} />
				{/each}
			</div>
		{:else}
			<div class="py-16 text-center">
				<svg class="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
				<p class="text-50">{i18n(I18nKey.animeNoResults)}</p>
			</div>
		{/if}

		<ClientPagination
			totalItems={filteredItems().length}
			{itemsPerPage}
			{currentPage}
			onPageChange={goToPage}
		/>
	{/if}
</div>

<BilibiliDetailModal anime={selectedAnime} onclose={closeDetail} />