<script lang="ts">
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type { NsfwMode } from "@/types/nsfw";
import type { VndbUlistEntry } from "@/types/vndb";
import { isVndbNsfw } from "@/utils/nsfw-utils";
import {
  formatVndbLength,
  getVndbStatusText,
  normalizeVndbLabel,
} from "@/utils/vndb-utils";
import MediaCard from "../MediaCard.svelte";

interface Props {
  item: VndbUlistEntry;
  loadImage?: boolean;
  vnBaseUrl?: string;
  nsfw?: NsfwMode; // NSFW 处理："off" | "blur" | "hide"
}

const {
  item,
  loadImage = false,
  vnBaseUrl = "https://vndb.org/",
  nsfw = "off",
}: Props = $props();

const STATUS_COLORS: Record<string, string> = {
  wishlist: "bg-blue-500",
  playing: "bg-yellow-500",
  finished: "bg-green-500",
  stalled: "bg-orange-500",
  dropped: "bg-red-500",
  unknown: "bg-gray-500",
};

const firstLabel = $derived(
  (item.labels || []).find((label) =>
    ["wishlist", "playing", "finished", "stalled", "dropped"].includes(
      normalizeVndbLabel(label.label),
    ),
  )?.label ||
    item.labels?.[0]?.label ||
    "",
);
const labelKey = $derived(normalizeVndbLabel(firstLabel));
const statusText = $derived(
  firstLabel ? getVndbStatusText(labelKey, firstLabel) : i18n(I18nKey.vndbStatusUnknown),
);
const statusColor = $derived(STATUS_COLORS[labelKey] || "bg-gray-500");

const title = $derived(item.vn?.alttitle || item.vn?.title || "VNDB");
const altTitle = $derived(item.vn?.title && item.vn.title !== title ? item.vn.title : "");
const year = $derived(item.vn?.released ? item.vn.released.substring(0, 4) : "");
const imageUrl = $derived(item.vn?.image?.url || item.vn?.image?.thumbnail || "");
const coverSrcs = $derived(imageUrl ? [imageUrl] : []);
const imageBlur = $derived(nsfw === "blur" && isVndbNsfw(item));
const userVote = $derived(item.vote);
const rating = $derived(item.vn?.rating);
const voteCount = $derived(item.vn?.votecount);
const lengthText = $derived(formatVndbLength(item.vn?.length, item.vn?.length_minutes));
const developerText = $derived(
  (item.vn?.developers || []).slice(0, 2).map((p) => p.name).join(" / "),
);
const languageText = $derived(
  (item.vn?.languages || []).slice(0, 4).map((l) => l.toUpperCase()).join(" / "),
);
const platformText = $derived(
  (item.vn?.platforms || []).slice(0, 4).map((p) => p.toUpperCase()).join(" / "),
);
const metaText = $derived(
  [developerText, languageText, platformText].filter(Boolean).join(" · "),
);
const notes = $derived(item.notes || "");
const playRange = $derived([item.started, item.finished].filter(Boolean).join(" ~ "));
const tags = $derived((item.vn?.tags || []).map((tag) => tag.name));
const link = $derived(`${vnBaseUrl}${item.vn?.id || item.id}`);
</script>

<MediaCard
  href={link}
  {coverSrcs}
  failedCoversKey="vndb-failed-covers"
  {statusText}
  {statusColor}
  {title}
  placeholder="VN"
  {loadImage}
  score={userVote}
  {imageBlur}
  {altTitle}
  {tags}
>
  {#snippet middle()}
    {#if year || lengthText}
      <p class="mt-1 text-xs text-white/70">
        {#if year}{year}{/if}
        {#if year && lengthText} · {/if}
        {#if lengthText}{lengthText}{/if}
      </p>
    {/if}
    {#if playRange}
      <p class="mt-1 text-xs text-white/70">{playRange}</p>
    {/if}
    {#if rating}
      <p class="mt-0.5 text-xs text-white/70">
        <span class="font-medium text-yellow-300">VNDB</span> {rating}
        {#if voteCount}
          <span class="text-white/50">· {voteCount} {i18n(I18nKey.vndbVotes)}</span>
        {/if}
      </p>
    {/if}
    {#if metaText}
      <p class="line-clamp-1 mt-0.5 text-xs text-white/65" title={metaText}>{metaText}</p>
    {/if}
    {#if notes}
      <p class="line-clamp-1 mt-1 leading-relaxed text-xs text-white/75" title={notes}>{notes}</p>
    {/if}
  {/snippet}
</MediaCard>
