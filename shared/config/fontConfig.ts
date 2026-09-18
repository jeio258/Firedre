import type { FontDefinition, FontSelectionConfig } from "@/types/fontConfig";

export const fontsList: FontDefinition[] = [
	{
		name: "Zen Maru Gothic",
		cssVariable: "--font-zen-maru-gothic",
		provider: "fontsource",
		weights: ["300", "400", "500", "600", "700"],
		styles: ["normal"],
		subsets: ["latin", "cyrillic"],
		fallbacks: ["sans-serif"],
	},
	{
		name: "Inter",
		cssVariable: "--font-inter",
		provider: "fontsource",
		weights: ["300", "400", "500", "600", "700"],
		styles: ["normal"],
		subsets: ["latin", "cyrillic"],
		fallbacks: ["sans-serif"],
	},
	{
		name: "JetBrains Mono",
		cssVariable: "--font-jetbrains-mono",
		provider: "fontsource",
		weights: ["400", "700"],
		styles: ["normal"],
		subsets: ["latin", "cyrillic"],
		fallbacks: [
			"ui-monospace",
			"SFMono-Regular",
			"Menlo",
			"Monaco",
			"Consolas",
			"Liberation Mono",
			"Courier New",
			"monospace",
		],
	},

	{
		name: "GreatVibes Regular 2",
		cssVariable: "--font-greatvibes",
		provider: "local",
		options: {
			variants: [
				{
					src: ["./src/assets/fonts/GreatVibes-Regular-2.otf"],
				},
			],
		},
		fallbacks: ["sans-serif"],
	},
	{
		// 方正筑紫A圆体B（unicode-range 分片版，产物 public/fonts/fangzheng/，pnpm fonts:build 生成）
		// provider none：不进 Astro Fonts API（单文件 1.28MB 整包 preload），由 FontSetup 直出分片 CSS
		name: "Fangzheng ZhuZi A Yuan B",
		cssVariable: "--font-fangzheng-zizhu",
		provider: "none",
		display: "swap",
		fallbacks: ["sans-serif"],
	},
];

export const fontConfig: FontSelectionConfig = {
	enable: true,

	selected: ["--font-fangzheng-zizhu"],

	bannerTitleFont: "--font-zen-maru-gothic",
	bannerSubtitleFont: "--font-inter",
	navbarTitleFont: "",
	codeFont: "--font-jetbrains-mono",
};
