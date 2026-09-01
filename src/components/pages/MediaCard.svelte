<script lang="ts">
import type { Snippet } from "svelte";
import { getFailedCovers, markCoverFailed } from "@/utils/failed-covers";

interface Props {
  href: string;
  coverSrcs: string[];
  failedCoversKey: string;
  statusText: string;
  statusColor: string;
  title: string;
  placeholder: string;
  loadImage?: boolean;
  score?: number;
  imageBlur?: boolean;
  altTitle?: string;
  tags?: string[];
  middle?: Snippet;
}

const {
  href,
  coverSrcs,
  failedCoversKey,
  statusText,
  statusColor,
  title,
  placeholder,
  loadImage = false,
  score = 0,
  imageBlur = false,
  altTitle = "",
  tags = [],
  middle,
}: Props = $props();

const visibleTags = $derived(tags.slice(0, 2));
const hiddenTagCount = $derived(Math.max(tags.length - visibleTags.length, 0));

let initialSrc = $state("");

$effect(() => {
  const sources = coverSrcs;
  initialSrc = sources[0] || "";
  if (typeof window === "undefined" || sources.length === 0) return;
  const failed = getFailedCovers(failedCoversKey);
  const firstGood = sources.find((url) => !failed.has(url));
  if (firstGood) initialSrc = firstGood;
});

function handleLoad(e: Event) {
  const img = e.currentTarget as HTMLImageElement;
  img.style.opacity = "1";
  const ph = img.parentElement?.querySelector(".lqip-placeholder");
  if (ph) ph.classList.add("loaded");
}

function handleError(e: Event) {
  const img = e.currentTarget as HTMLImageElement;
  const current = img.src;
  markCoverFailed(current, failedCoversKey);
  const idx = coverSrcs.indexOf(current);
  if (idx >= 0 && idx < coverSrcs.length - 1) {
    img.src = coverSrcs[idx + 1];
  } else {
    img.style.display = "none";
  }
}
</script>

<a
  href={href}
  target="_blank"
  rel="noopener noreferrer nofollow"
  class="group relative block overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
>
  <div class="relative aspect-2/3 overflow-hidden">
    {#if initialSrc}
      <div
        class="lqip-placeholder pointer-events-none absolute inset-0"
        style="background: var(--muted)"
        aria-hidden="true"
      ></div>
      <img
        src={loadImage ? initialSrc : undefined}
        data-src={loadImage ? undefined : initialSrc}
        alt={title}
        class="pointer-events-none h-full w-full object-cover opacity-0 transition-all duration-500 ease-out group-hover:scale-105"
        style={imageBlur ? "filter: blur(20px)" : undefined}
        loading="lazy"
        decoding="async"
        onload={handleLoad}
        onerror={handleError}
      />
    {:else}
      <div
        class="flex h-full w-full items-center justify-center bg-gray-200 dark:bg-gray-700"
      >
        <div class="text-4xl font-bold text-gray-400 dark:text-gray-500">{placeholder}</div>
      </div>
    {/if}

    <div
      class="absolute top-2 left-2 rounded-full bg-gray-500 px-2 py-1 text-xs font-medium text-white {statusColor}"
    >
      {statusText}
    </div>

    {#if score}
      <div
        class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm"
      >
        <span class="text-yellow-400">&#11088;</span>
        {score}
      </div>
    {/if}

    <div class="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"></div>
    <div class="absolute bottom-0 left-0 right-0 p-3">
      <h3 class="line-clamp-2 text-sm font-bold text-white drop-shadow-lg">{title}</h3>
      {#if altTitle}
        <p class="line-clamp-1 mt-0.5 text-xs text-white/60">{altTitle}</p>
      {/if}
      {@render middle?.()}
      {#if visibleTags.length > 0}
        <div class="mt-1.5 flex flex-wrap gap-1">
          {#each visibleTags as tag}
            <span
              class="rounded bg-white/20 px-1.5 py-0.5 text-[0.6rem] text-white/90 backdrop-blur-sm"
              >{tag}</span
            >
          {/each}
          {#if hiddenTagCount > 0}
            <span
              class="rounded bg-white/20 px-1.5 py-0.5 text-[0.6rem] text-white/60 backdrop-blur-sm"
              >+{hiddenTagCount}</span
            >
          {/if}
        </div>
      {/if}
    </div>
  </div>
</a>
