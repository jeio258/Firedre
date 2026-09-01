export type OverlaySwitchable =
	| boolean
	| {
			opacity?: boolean; // 壁纸透明度调节开关
			blur?: boolean; // 背景模糊度调节开关
			cardOpacity?: boolean; // 卡片透明度调节开关
	  };

/** 各开关含义详见 src/config/displaySettingsConfig.ts */
export type DisplaySettingsConfig = {
	enable: boolean;
	themeColorSwitchable: boolean;
	layoutSwitchable: boolean;
	cardBorderSwitchable: boolean;
	cardFollowThemeSwitchable: boolean;
	wallpaperModeSwitchable: boolean;
	wavesSwitchable: boolean;
	gradientSwitchable: boolean;
	bannerTitleSwitchable: boolean;
	bannerCarouselSwitchable: boolean;
	overlaySwitchable: OverlaySwitchable;
	sakuraSwitchable: boolean;
};
