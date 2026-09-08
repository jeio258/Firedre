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

export type MobileBottomComponentConfig = {
	type: WidgetComponentType;
	enable: boolean;
	showTitle?: boolean;
	showOnPostPage?: boolean;
	hideOnNonPostPage?: boolean;
	specificConfig?: WidgetSpecificConfig;
	customProps?: Record<string, unknown>;
};

export type WidgetSpecificConfig = {
	hidden?: ("mobile" | "tablet" | "desktop")[];            
	collapseThreshold?: number;        
	calendar?: CalendarConfig;            
	ad?: AdConfig;            
	siteInfo?: SiteInfoConfig;              
	dynamic?: DynamicWidgetConfig;              
};

export type DynamicWidgetConfig = {
	limit?: number; // 显示的最新动态数量，默认 3
};

export type SiteInfoConfig = {
	unknownBuildPlatform?: string; // 未识别的构建平台显示文本，默认 "Unknown CI"
};

export type CalendarConfig = {
	showHeatmap: boolean;
};

export type AdConfig = {
	title?: string;         
	content?: string;           
	image?: { src: string; alt?: string; link?: string; external?: boolean };        
	link?: { text: string; url: string; external?: boolean };          
	padding?: {
		top?: string;
		right?: string;
		bottom?: string;
		left?: string;
		all?: string;
	};       
	closable?: boolean;         
	displayCount?: number;                 
	expireDate?: string;                      
};

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
