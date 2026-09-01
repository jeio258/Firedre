import type { UserSubjectCollection } from "@/types/bangumi";
import type { MalListItem } from "@/types/mal";
import type { NsfwMode } from "@/types/nsfw";
import type { VndbUlistEntry } from "@/types/vndb";

const NSFW_KEYWORDS = [
	"Hentai",
	"Ecchi",
	"えっち",
	"エッチ",
	"NSFW",
	"R18",
	"R-18",
	"18禁",
	"黄油",
	"卖肉",
	"成人",
	"成人向け",
	"エロ",
];

export function isVndbNsfw(item: VndbUlistEntry): boolean {
	const img = item.vn?.image;

	return (
		(img?.sexual ?? 0) > 1 ||
		(img?.violence ?? 0) > 1 ||
		(item.vn?.tags ?? []).some((t) => NSFW_KEYWORDS.includes(t.name))
	);
}

export function isMalNsfw(item: MalListItem): boolean {
	return (item.node?.genres ?? []).some((g) => NSFW_KEYWORDS.includes(g.name));
}

export function isBangumiNsfw(item: UserSubjectCollection): boolean {
	if (item.subject?.nsfw === true) return true; // 原生布尔（首选）
	const names = [
		...(item.tags ?? []),
		...(item.subject?.tags ?? []).map((t) => t.name),
	];
	return names.some((n) => NSFW_KEYWORDS.includes(n));        
}

export function filterNsfw<T>(
	items: T[],
	mode: NsfwMode,
	isNsfw: (x: T) => boolean,
): T[] {
	return mode === "hide" ? items.filter((x) => !isNsfw(x)) : items;
}
