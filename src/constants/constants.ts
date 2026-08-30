export const LIGHT_MODE = "light",
	DARK_MODE = "dark",
	SYSTEM_MODE = "system";
export const DEFAULT_THEME: typeof LIGHT_MODE = LIGHT_MODE; // 仅作为向后兼容的默认值，实际使用 siteConfig.themeColor.defaultMode

// Wallpaper modes
export const WALLPAPER_BANNER = "banner",
	WALLPAPER_FULLSCREEN = "fullscreen",
	WALLPAPER_OVERLAY = "overlay",
	WALLPAPER_NONE = "none";

// Banner height unit: vh
export const BANNER_HEIGHT = 35;
export const BANNER_HEIGHT_EXTEND = 30;
export const BANNER_HEIGHT_HOME: number = BANNER_HEIGHT + BANNER_HEIGHT_EXTEND;

// The height the main panel overlaps the banner, unit: rem

// Non-home banner height (unit: vh) — banner mode, desktop only.
// 非首页 banner 高度（vh，仅 banner 模式/桌面）：= 65 - 15vh 上移 = 50。改 45 则上移 20vh，35 则回到原始 fuwari 30vh
export const BANNER_HEIGHT_NON_HOME = 50;

// Page width: rem
export const PAGE_WIDTH = 100;
