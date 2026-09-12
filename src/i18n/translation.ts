import { siteConfig } from "../config";
import type I18nKey from "./i18nKey";

export type Translation = {
	[K in I18nKey]: string;
};

type LangMap = Record<string, Translation>;

const DEFAULT_LANG = "en";

declare global {
	interface Window {
		__FIREDRE_I18N__?: LangMap;
	}
}

// 客户端：使用 Layout 注入的当前语言表（六语言全量不进 bundle）；
// 服务端/Node（SSR、测试）：动态加载全部语言。
const maps: LangMap = await (async () => {
	if (typeof window !== "undefined") {
		// 注入的是当前语言的「键→文案」表；包装成 LangMap 形状供各语言键查同一张表
		const injected = window.__FIREDRE_I18N__;
		if (injected) {
			return Object.fromEntries(
				["en", "en_us", "en_gb", "en_au", "zh_cn", "zh_tw", "ja", "ja_jp", "ru", "ru_ru", "ko", "ko_kr"].map(
					(l) => [l, injected],
				),
			);
		}
		return {};
	}
	const [en, ja, ko, ru, zhCN, zhTW] = await Promise.all([
		import("./languages/en"),
		import("./languages/ja"),
		import("./languages/ko"),
		import("./languages/ru"),
		import("./languages/zh_CN"),
		import("./languages/zh_TW"),
	]);
	return {
		en: en.en,
		en_us: en.en,
		en_gb: en.en,
		en_au: en.en,
		zh_cn: zhCN.zh_CN,
		zh_tw: zhTW.zh_TW,
		ja: ja.ja,
		ja_jp: ja.ja,
		ru: ru.ru,
		ru_ru: ru.ru,
		ko: ko.ko,
		ko_kr: ko.ko,
	};
})();

export function getTranslation(lang: string): Translation {
	return maps[lang.toLowerCase()] || maps[DEFAULT_LANG];
}

export function i18n(key: I18nKey): string {
	const lang = (siteConfig.lang || DEFAULT_LANG).toLowerCase();
	const value = getTranslation(lang)[key];

	// 如果当前语言没有翻译（或为空），则使用中文作为备选
	if (!value && lang !== "zh_cn") {
		const chineseValue = getTranslation("zh_cn")[key];
		if (chineseValue) {
			return chineseValue;
		}
	}

	return value || getTranslation(DEFAULT_LANG)[key];
}
