<script lang="ts">
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type { UserSubjectCollection } from "@/types/bangumi";
import type { NsfwMode } from "@/types/nsfw";
import { isBangumiNsfw } from "@/utils/nsfw-utils";
import MediaCard from "../MediaCard.svelte";

interface Props {
  item: UserSubjectCollection;
  loadImage?: boolean;
  subjectBaseUrl?: string;
  nsfw?: NsfwMode; // NSFW 处理："off" | "blur" | "hide"
}

const {
  item,
  loadImage = false,
  subjectBaseUrl = "https://bangumi.one/subject/",
  nsfw = "off",
}: Props = $props();

const STATUS_COLORS: Record<number, string> = {
  1: "bg-blue-500",
  2: "bg-green-500",
  3: "bg-yellow-500",
  4: "bg-orange-500",
  5: "bg-red-500",
};

function getStatusText(type: number): string {
  const subjectType = item.subject?.type;
  switch (type) {
    case 1:
      if (subjectType === 1) return i18n(I18nKey.bangumiStatusBookWish);
      if (subjectType === 3) return i18n(I18nKey.bangumiStatusMusicWish);
      if (subjectType === 4) return i18n(I18nKey.bangumiStatusGameWish);
      return i18n(I18nKey.bangumiStatusWish);
    case 2:
      if (subjectType === 1) return i18n(I18nKey.bangumiStatusBookRead);
      if (subjectType === 3) return i18n(I18nKey.bangumiStatusMusicListened);
      if (subjectType === 4) return i18n(I18nKey.bangumiStatusGamePlayed);
      return i18n(I18nKey.bangumiStatusWatched);
    case 3:
      if (subjectType === 1) return i18n(I18nKey.bangumiStatusBookReading);
      if (subjectType === 3) return i18n(I18nKey.bangumiStatusMusicListening);
      if (subjectType === 4) return i18n(I18nKey.bangumiStatusGamePlaying);
      return i18n(I18nKey.bangumiStatusWatching);
    case 4:
      return i18n(I18nKey.bangumiStatusOnHold);
    case 5:
      return i18n(I18nKey.bangumiStatusDropped);
    default:
      return i18n(I18nKey.bangumiStatusUnknown);
  }
}

const tags = $derived(
  item.tags && item.tags.length > 0
    ? item.tags
    : (item.subject?.tags || []).map((t) => t.name).slice(0, 5),
);
const images = $derived(item.subject?.images);
const coverSrcs = $derived(
  images
    ? [images.medium, images.common, images.small, images.large].filter(Boolean)
    : [],
);
const title = $derived(item.subject?.name_cn || item.subject?.name || "");
const year = $derived(item.subject?.date ? item.subject.date.substring(0, 4) : "");
const statusColor = $derived(STATUS_COLORS[item.type] || "bg-gray-500");
const score = $derived(item.subject?.score || 0);
const imageBlur = $derived(nsfw === "blur" && isBangumiNsfw(item));
</script>

<MediaCard
  href="{subjectBaseUrl}{item.subject?.id}"
  {coverSrcs}
  failedCoversKey="bangumi-failed-covers"
  statusText={getStatusText(item.type)}
  {statusColor}
  {title}
  placeholder="📖"
  {loadImage}
  {score}
  {imageBlur}
>
  {#snippet middle()}
    {#if year}
      <p class="mt-1 text-xs text-white/60">{year}</p>
    {/if}
    {#if item.comment}
      <p class="line-clamp-1 mt-1 leading-relaxed text-xs text-white/75" title={item.comment}>
        {item.comment}
      </p>
    {/if}
  {/snippet}
</MediaCard>
