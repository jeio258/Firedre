<script lang="ts">
import { onMount } from "svelte";
import GridSkeleton from "@/components/common/GridSkeleton.svelte";
import TabNav from "@/components/common/TabNav.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type { NsfwMode } from "@/types/nsfw";
import type { MalCategory } from "@/utils/mal-utils";
import { filterNsfw, isMalNsfw } from "@/utils/nsfw-utils";
import MalSection from "./MalSection.svelte";

interface Props {
	categories?: MalCategory[]; // 静态模式由服务端注入
	initialActiveCategory?: string;
	animeBaseUrl?: string;
	mangaBaseUrl?: string;
	nsfw?: NsfwMode; // NSFW 处理："off" | "blur" | "hide"
	dynamic?: boolean;
}

let {
	categories: initialCategories = [],
	initialActiveCategory,
	animeBaseUrl = "https://myanimelist.net/anime/",
	mangaBaseUrl = "https://myanimelist.net/manga/",
	nsfw = "off",
	dynamic = false,
}: Props = $props();

// 数据：静态模式由 initialCategories 注入；动态模式 onMount 从同源代理拉取
let categories = $state<MalCategory[]>(initialCategories);
let loading = $state(false);
let error = $state(false);

onMount(async () => {
	if (!dynamic) return;
	loading = true;
	error = false;
	try {
		const resp = await fetch("/api/mal/");
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const data = await resp.json();
		const anime = filterNsfw(
			Array.isArray(data.anime) ? (data.anime as MalCategory["items"]) : [],
			nsfw,
			isMalNsfw,
		);
		const manga = filterNsfw(
			Array.isArray(data.manga) ? (data.manga as MalCategory["items"]) : [],
			nsfw,
			isMalNsfw,
		);
		const built: MalCategory[] = [];
		if (anime.length > 0) {
			built.push({ id: "anime", name: i18n(I18nKey.malCategoryAnime), count: anime.length, items: anime });
		}
		if (manga.length > 0) {
			built.push({ id: "manga", name: i18n(I18nKey.malCategoryManga), count: manga.length, items: manga });
		}
		categories = built;
	} catch (e) {
		error = true;
	} finally {
		loading = false;
	}
});

let activeCategory = $state("");

$effect(() => {
	if (initialActiveCategory) {
		activeCategory = initialActiveCategory;
	} else if (categories[0]?.id) {
		activeCategory = categories[0].id;
	}
});

function handleCategoryChange(categoryId: string) {
	activeCategory = categoryId;
}
</script>

{#if dynamic && loading}
	<GridSkeleton />
{:else if dynamic && error}
	<div class="text-center py-16">
		<div class="inline-flex items-center justify-center w-16 h-16 bg-(--btn-regular-bg) rounded-full mb-6 border border-(--line-divider)">
			<span class="text-[2rem] text-red-500">⚠</span>
		</div>
		<h2 class="text-xl font-semibold text-black/80 dark:text-white/80 mb-3">{i18n(I18nKey.malFetchError)}</h2>
		<p class="text-black/60 dark:text-white/60 mb-4 max-w-md mx-auto">{i18n(I18nKey.malFetchErrorDesc)}</p>
	</div>
{:else if categories.length > 0}
	<TabNav tabs={categories} activeTab={activeCategory} onTabChange={handleCategoryChange} />

	{#each categories as category (category.id)}
		<MalSection
			sectionId={category.id}
			items={category.items}
			isActive={category.id === activeCategory}
			itemsPerPage={24}
			kind={category.id}
			baseUrl={category.id === "manga" ? mangaBaseUrl : animeBaseUrl}
			{nsfw}
		/>
	{/each}
{/if}
