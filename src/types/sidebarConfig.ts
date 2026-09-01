// 组件配置类型定义
export type WidgetComponentType =
	| "profile"
	| "announcement"
	| "categories"
	| "tags"
	| "sidebarToc"
	| "advertisement"
	| "stats"
	| "calendar"
	| "music"
	| "siteInfo"
	| "dynamic";

/** 字段含义详见 src/config/sidebarConfig.ts 的 leftComponents 说明 */
export type WidgetComponentConfig = {
	type: WidgetComponentType;
	enable: boolean;
	showTitle?: boolean;
	position: "top" | "sticky";
	showOnPostPage?: boolean;
	hideOnNonPostPage?: boolean;
	specificConfig?: WidgetSpecificConfig;
	customProps?: Record<string, unknown>;
};

/** 同 WidgetComponentConfig，但不含 position */
export type MobileBottomComponentConfig = {
	type: WidgetComponentType;
	enable: boolean;
	showTitle?: boolean;
	showOnPostPage?: boolean;
	hideOnNonPostPage?: boolean;
	specificConfig?: WidgetSpecificConfig;
	customProps?: Record<string, unknown>;
};

// 组件通用专属配置
export type WidgetSpecificConfig = {
	hidden?: ("mobile" | "tablet" | "desktop")[]; // 在指定设备上隐藏
	collapseThreshold?: number; // 折叠阈值
	calendar?: CalendarConfig; // 日历组件专用配置
	ad?: AdConfig; // 广告组件专用配置
	siteInfo?: SiteInfoConfig; // 站点信息组件专用配置
	dynamic?: DynamicWidgetConfig; // 最新动态组件专用配置
};

export type DynamicWidgetConfig = {
	limit?: number; // 显示的最新动态数量，默认 3
};

// 站点信息组件专用配置
export type SiteInfoConfig = {
	unknownBuildPlatform?: string; // 未识别的构建平台显示文本，默认 "Unknown CI"
};

// 日历组件专用配置
export type CalendarConfig = {
	// 是否显示年度文章热力图
	showHeatmap: boolean;
};

// 广告栏配置
export type AdConfig = {
	title?: string; // 广告栏标题
	content?: string; // 广告栏文本内容
	image?: { src: string; alt?: string; link?: string; external?: boolean }; // 广告图片
	link?: { text: string; url: string; external?: boolean }; // 广告链接按钮
	padding?: {
		top?: string;
		right?: string;
		bottom?: string;
		left?: string;
		all?: string;
	}; // 内边距
	closable?: boolean; // 是否可关闭
	displayCount?: number; // 显示次数限制，-1为无限制
	expireDate?: string; // 过期时间 (ISO 8601 格式)
};

/** 字段含义详见 src/config/sidebarConfig.ts */
export type SidebarLayoutConfig = {
	enable: boolean;
	position: "left" | "right" | "both";
	tabletSidebar?: "left" | "right";
	hideSidebarOnPostPage?: boolean;
	showBothSidebarsOnPostPage?: boolean;
	leftComponents: WidgetComponentConfig[];
	rightComponents: WidgetComponentConfig[];
	mobileBottomComponents: MobileBottomComponentConfig[];
};
