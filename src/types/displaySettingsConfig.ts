export type OverlaySwitchable =
	| boolean
	| {
			opacity?: boolean;             
			blur?: boolean;             
			cardOpacity?: boolean;             
	  };

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
