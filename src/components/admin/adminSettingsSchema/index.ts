export * from "./types";

import { extensionGroups } from "./extensions";
import { featureGroups } from "./features";
import { pageGroups } from "./pages";
import { siteGroups } from "./site";
import type { Group } from "./types";

// 组显示顺序（按分类聚簇 + 使用频率）——单一显式来源，与源文件物理顺序解耦；
// AdminSettings 按 category 过滤后即按此顺序展示
const GROUP_ORDER = [
	// 站点配置
	"basic",
	"profile",
	// 外观布局
	"nav",
	"sidebar",
	"theme",
	"panel",
	"effects",
	"font",
	"cover",
	"expressiveCode",
	// 功能配置
	"post",
	"comment",
	"music",
	"hitokoto",
	"mermaid",
	"plantuml",
	// 页面配置
	"bilibili",
	"myanimelist",
	"vndb",
	"bangumi",
	"sponsor",
	"bookmarks",
	// 扩展功能
	"footer",
	"ads",
	"license",
	"analytics",
];
const orderOf = (key: string) => {
	const i = GROUP_ORDER.indexOf(key);
	return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

export const GROUPS: Group[] = [
	...siteGroups,
	...featureGroups,
	...pageGroups,
	...extensionGroups,
].sort((a, b) => orderOf(a.key) - orderOf(b.key));
