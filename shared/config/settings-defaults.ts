import { appearanceDefaults } from "./defaults/appearance";
import { extensionsDefaults } from "./defaults/extensions";
import { featuresDefaults } from "./defaults/features";
import { pagesDefaults } from "./defaults/pages";
import { siteDefaults } from "./defaults/site";

// 新增布尔开关统一用 `enable`（存量键 enable/enabled 混用不动，避免改生产数据）
// 分组真源见 ./defaults/*（自单文件机械拆分，键值零改动）
export const settingsDefaults = {
	basic: siteDefaults.basic,
	profile: siteDefaults.profile,
	panel: siteDefaults.panel,
	announcement: siteDefaults.announcement,
	theme: appearanceDefaults.theme,
	nav: appearanceDefaults.nav,
	sidebar: appearanceDefaults.sidebar,
	font: appearanceDefaults.font,
	cover: appearanceDefaults.cover,
	effects: appearanceDefaults.effects,
	expressiveCode: appearanceDefaults.expressiveCode,
	post: featuresDefaults.post,
	comment: featuresDefaults.comment,
	music: featuresDefaults.music,
	hitokoto: featuresDefaults.hitokoto,
	mermaid: featuresDefaults.mermaid,
	plantuml: featuresDefaults.plantuml,
	dynamic: featuresDefaults.dynamic,
	analytics: featuresDefaults.analytics,
	friends: pagesDefaults.friends,
	gallery: pagesDefaults.gallery,
	bookmarks: pagesDefaults.bookmarks,
	bilibili: pagesDefaults.bilibili,
	vndb: pagesDefaults.vndb,
	myanimelist: pagesDefaults.myanimelist,
	bangumi: pagesDefaults.bangumi,
	sponsor: pagesDefaults.sponsor,
	ads: extensionsDefaults.ads,
	footer: extensionsDefaults.footer,
	license: extensionsDefaults.license,
} as const;
