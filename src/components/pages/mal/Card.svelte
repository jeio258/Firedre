<script lang="ts">
import type { MalListItem } from "@/types/mal";
import type { NsfwMode } from "@/types/nsfw";
import {
  getMalSeasonText,
  getMalStatusText,
  type MalListKind,
} from "@/utils/mal-utils";
import { isMalNsfw } from "@/utils/nsfw-utils";
import MediaCard from "../MediaCard.svelte";

interface Props {
  item: MalListItem;
  loadImage?: boolean;
  kind?: MalListKind;
  baseUrl?: string;
  nsfw?: NsfwMode; // NSFW 处理："off" | "blur" | "hide"
}

const {
  item,
  loadImage = false,
  kind = "anime",
  baseUrl = "https://myanimelist.net/anime/",
  nsfw = "off",
}: Props = $props();

const STATUS_COLORS: Record<string, string> = {
  watching: "bg-yellow-500",
  reading: "bg-yellow-500",
  completed: "bg-green-500",
  on_hold: "bg-orange-500",
  dropped: "bg-red-500",
  plan_to_watch: "bg-blue-500",
  plan_to_read: "bg-blue-500",
  unknown: "bg-gray-500",
};

const node = $derived(item.node);
const isManga = $derived(kind === "manga");
const userStatus = $derived(item.list_status?.status || "unknown");
const statusText = $derived(getMalStatusText(userStatus));
const statusColor = $derived(STATUS_COLORS[userStatus] || "bg-gray-500");

const title = $derived(node.title || "MAL");
const altTitle = $derived(
  node.alternative_titles?.en && node.alternative_titles.en !== title
    ? node.alternative_titles.en
    : node.alternative_titles?.ja && node.alternative_titles.ja !== title
      ? node.alternative_titles.ja
      : "",
);
const coverUrl = $derived(node.main_picture?.large || node.main_picture?.medium || "");
const coverSrcs = $derived(coverUrl ? [coverUrl] : []);
const userScore = $derived(item.list_status?.score || 0);
const meanScore = $derived(node.mean || 0);

// 日期：动画用季度+年份，漫画用起始日期年份
const seasonText = $derived(
  isManga
    ? ""
    : node.start_season
      ? [getMalSeasonText(node.start_season.season || ""), node.start_season.year]
          .filter(Boolean)
          .join(" ")
      : "",
);
const yearText = $derived(
  isManga ? (node.start_date ? node.start_date.substring(0, 4) : "") : "",
);
const dateText = $derived(seasonText || yearText);

const watched = $derived(
  isManga ? item.list_status?.num_chapters_read || 0 : item.list_status?.num_episodes_watched || 0,
);
const total = $derived(isManga ? node.num_chapters || 0 : node.num_episodes || 0);
const volumesWatched = $derived(item.list_status?.num_volumes_read || 0);
const volumesTotal = $derived(node.num_volumes || 0);
const episodesText = $derived(
  watched > 0 ? `${watched}${total ? `/${total}` : ""}` : total > 0 ? `0/${total}` : "",
);
const volumesText = $derived(
  volumesWatched > 0 ? `${volumesWatched}${volumesTotal ? `/${volumesTotal}` : ""}卷` : "",
);
const progressText = $derived(
  isManga ? [episodesText, volumesText].filter(Boolean).join(" ") : episodesText,
);
const genreNames = $derived((node.genres || []).map((g) => g.name));
const link = $derived(`${baseUrl}${node.id}`);
const imageBlur = $derived(nsfw === "blur" && isMalNsfw(item));
</script>

<MediaCard
  href={link}
  {coverSrcs}
  failedCoversKey="mal-failed-covers"
  {statusText}
  {statusColor}
  {title}
  placeholder="MAL"
  {loadImage}
  score={userScore}
  {imageBlur}
  {altTitle}
  tags={genreNames}
>
  {#snippet middle()}
    {#if dateText || progressText}
      <p class="mt-1 text-xs text-white/70">
        {#if dateText}{dateText}{/if}
        {#if dateText && progressText} · {/if}
        {#if progressText}{progressText}{/if}
      </p>
    {/if}
    {#if meanScore > 0}
      <p class="mt-0.5 text-xs text-white/70">
        <span class="font-medium text-yellow-300">MAL</span> {meanScore}
      </p>
    {/if}
  {/snippet}
</MediaCard>
