export type ExpressiveCodeConfig = {

	theme?: string;

	darkTheme: string;

	lightTheme: string;

	pluginCollapsible?: PluginCollapsibleConfig;

	pluginLanguageBadge?: PluginLanguageBadgeConfig;

	pluginLanguageLogo?: PluginLanguageLogoConfig;
};

export type PluginLanguageBadgeConfig = {

	enable: boolean;
};

export type LanguageLogoColor = "mono" | "original" | "theme" | `#${string}`;

export type PluginLanguageLogoConfig = {

	enable: boolean;

	color?: LanguageLogoColor;

	excludedLangs?: string[];
};

export type PluginCollapsibleConfig = {
	enable: boolean;               
	lineThreshold: number;             
	previewLines: number;              
	defaultCollapsed: boolean;          
};
