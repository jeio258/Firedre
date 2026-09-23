import { siteConfig } from "../config";
import type I18nKey from "./i18nKey";

export type Translation = {
	[K in I18nKey]: string;
};

type LangMap = Record<string, Translation>;

const DEFAULT_LANG = "en";

declare global {
	interface Window {
		// Layout 注入的是当前语言的「键→文案」表（单语言全量，非语言映射）
		__FIREDRE_I18N__?: Translation;
	}
}

// 客户端：使用 Layout 注入的当前语言表（六语言全量不进 bundle）；
// 服务端/Node（SSR、测试）：动态加载全部语言。
const maps: LangMap = await (async () => {
	if (typeof window !== "undefined") {
		// 词典由 /i18n.js 注入。defer 经典脚本与 module 脚本在规范中属不同执行队列，
		// 无先后保证（island 可能先执行）→ 有界等待词典到位，避免水合期读到空表而抛错。
		let injected = window.__FIREDRE_I18N__;
		for (let i = 0; !injected && i < 60; i++) {
			await new Promise((r) => setTimeout(r, 25));
			injected = window.__FIREDRE_I18N__;
		}
		if (injected) {
			return Object.fromEntries(
				[
					"en",
					"en_us",
					"en_gb",
					"en_au",
					"zh_cn",
					"zh_tw",
					"ja",
					"ja_jp",
					"ru",
					"ru_ru",
					"ko",
					"ko_kr",
				].map((l) => [l, injected]),
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
	// 浏览器分支：等待超时后仍可能为空表 → 回退到当前注入表，保证调用方永不拿到 undefined
	const injected =
		typeof window !== "undefined" ? window.__FIREDRE_I18N__ : undefined;
	return (
		maps[lang.toLowerCase()] ||
		maps[DEFAULT_LANG] ||
		injected ||
		({} as Translation)
	);
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
