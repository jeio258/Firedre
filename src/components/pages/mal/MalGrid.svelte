<script lang="ts">
import { onMount } from "svelte";
import TabNav from "@/components/common/TabNav.svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type { MalListItem } from "@/types/mal";
import type { NsfwMode } from "@/types/nsfw";
import type { MalCategory } from "@/utils/mal-utils";
import { filterNsfw, isMalNsfw } from "@/utils/nsfw-utils";
import MalSection from "./MalSection.svelte";

interface Props {
	animeBaseUrl?: string;
	mangaBaseUrl?: string;
	nsfw?: NsfwMode; // NSFW 处理："off" | "blur" | "hide"
}

const {
	animeBaseUrl = "https://myanimelist.net/anime/",
	mangaBaseUrl = "https://myanimelist.net/manga/",
	nsfw = "off",
}: Props = $props();

// 数据由客户端经 /api/mal 同源代理拉取（代理侧分页抓取 + 边缘缓存 + clientId 不落前端），
// SSR 不再阻塞在第三方分页请求上
let categories = $state<MalCategory[]>([]);
let loading = $state(true);
let failed = $state(false);
let activeCategory = $state("");

onMount(() => {
	let cancelled = false;
	fetch("/api/mal/")
		.then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json() as Promise<{
				anime?: MalListItem[];
				manga?: MalListItem[];
			}>;
		})
		.then((data) => {
			if (cancelled) return;
			const anime = filterNsfw(data.anime || [], nsfw, isMalNsfw);
			const manga = filterNsfw(data.manga || [], nsfw, isMalNsfw);
			const out: MalCategory[] = [];
			if (anime.length > 0) {
				out.push({
					id: "anime",
					name: i18n(I18nKey.malCategoryAnime),
					count: anime.length,
					items: anime,
				});
			}
			if (manga.length > 0) {
				out.push({
					id: "manga",
					name: i18n(I18nKey.malCategoryManga),
					count: manga.length,
					items: manga,
				});
			}
			categories = out;
			activeCategory = out[0]?.id || "anime";
			loading = false;
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

function handleCategoryChange(categoryId: string) {
	activeCategory = categoryId;
}
</script>

{#if loading}
	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
		{#each Array(10) as _, i (i)}
			<div class="aspect-[3/4] rounded-xl bg-(--btn-regular-bg) animate-pulse"></div>
		{/each}
	</div>
{:else if failed}
	<div class="text-center py-16">
		<p class="text-black/60 dark:text-white/60">{i18n(I18nKey.malFetchErrorDesc)}</p>
	</div>
{:else if categories.length === 0}
	<div class="text-center py-16">
		<p class="text-black/60 dark:text-white/60">{i18n(I18nKey.malEmptyReason)}</p>
	</div>
{:else}
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