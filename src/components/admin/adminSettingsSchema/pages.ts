import type { Group } from "./types";

export const pageGroups: Group[] = [
	{
		key: "bilibili",
		title: "哔哩哔哩",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用 B 站页面", type: "boolean" },
			{ name: "uid", label: "B 站 UID", type: "text" },
			{ name: "title", label: "页面标题", type: "text" },
		],
	},
	{
		key: "sponsor",
		title: "打赏",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用打赏", type: "boolean" },
			{ name: "title", label: "打赏标题", type: "text" },
			{
				name: "sponsors",
				label: "打赏者列表",
				type: "records",
				recordFields: [
					{ key: "name", label: "名称", required: true },
					{ key: "avatar", label: "头像链接" },
					{ key: "amount", label: "金额" },
					{ key: "date", label: "日期" },
				],
				placeholder:
					"每行一位，字段顺序：名称 | 头像链接 | 金额 | 日期\n如：夏叶 | https://…/avatar.png | ¥50 | 2025-10-01",
			},
			{ name: "description", label: "打赏描述", type: "textarea" },
			{ name: "usage", label: "打赏用途说明", type: "textarea" },
			{ name: "showButtonInPost", label: "文章内打赏按钮", type: "boolean" },
			{ name: "showSponsorsList", label: "赞助列表", type: "boolean" },
		],
	},
	{
		key: "vndb",
		title: "VNDB",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用 VNDB 页面", type: "boolean" },
			{ name: "username", label: "VNDB 用户名", type: "text" },
		],
	},
	{
		key: "myanimelist",
		title: "MyAnimeList",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用 MAL 页面", type: "boolean" },
			{ name: "username", label: "MAL 用户名", type: "text" },
		],
	},
	{
		key: "bangumi",
		title: "番组计划",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用 Bangumi 页面", type: "boolean" },
			{ name: "username", label: "Bangumi 用户名", type: "text" },
		],
	},
	{
		key: "bookmarks",
		title: "书签导航",
		category: "页面配置",
		fields: [
			{ name: "title", label: "页面标题", type: "text" },
			{
				name: "favicon",
				label: "Favicon 自动获取配置",
				type: "records",
				objectFields: [
					{ key: "enabled", label: "启用(true/false)", valueType: "boolean" },
					{ key: "api", label: "接口地址" },
				],
				placeholder:
					"单行填写，字段顺序：启用(true/false) | 接口地址\n如：true | https://a.favicon.im/{domain}",
			},
			{ name: "description", label: "页面描述", type: "textarea" },
			{
				name: "groups",
				label: "书签分组与条目",
				type: "records",
				groupFields: [
					{ key: "name", label: "分组名", required: true },
					{ key: "icon", label: "分组图标" },
					{ key: "desc", label: "分组描述" },
					{ key: "weight", label: "权重", valueType: "number" },
					{ key: "enabled", label: "启用(true/false)", valueType: "boolean" },
					{ key: "id", label: "分组ID" },
				],
				itemFields: [
					{ key: "title", label: "标题", required: true },
					{ key: "url", label: "链接", required: true },
					{ key: "desc", label: "描述" },
					{ key: "icon", label: "图标" },
					{ key: "weight", label: "权重", valueType: "number" },
					{ key: "enabled", label: "启用(true/false)", valueType: "boolean" },
				],
				placeholder:
					"分组行（顶格）：分组名 | 分组图标 | 分组描述 | 权重 | 启用(true/false) | 分组ID\n子项行（行首缩进两空格）：标题 | 链接 | 描述 | 图标 | 权重 | 启用(true/false)",
			},
		],
	},
];
