import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";

export const SEASON_TYPE_I18N: Record<number, I18nKey> = {
	1: I18nKey.animeTypeAnime,
	2: I18nKey.animeTypeMovie,
	3: I18nKey.animeTypeDocumentary,
	4: I18nKey.animeTypeChinese,
	5: I18nKey.animeTypeDrama,
	7: I18nKey.animeTypeConcert,
};

export const SEASON_TYPE_COLORS: Record<number, string> = {
	1: "bg-blue-500",
	2: "bg-purple-500",
	3: "bg-emerald-500",
	4: "bg-orange-500",
	5: "bg-pink-500",
	7: "bg-yellow-500",
};

export function getSeasonTypeLabel(seasonType: number): string {
	return i18n(SEASON_TYPE_I18N[seasonType] || I18nKey.animeTypeAnime);
}

export function getSeasonTypeColor(seasonType: number): string {
	return SEASON_TYPE_COLORS[seasonType] || "bg-gray-500";
}
