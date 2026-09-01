/**
 * 字体配置统一入口：fontsList（Astro Font API 字体定义）+ fontConfig（字体选择与区域覆盖）。
 *
 * provider 支持：google / fontsource / local / bunny / fontshare / npm
 * @see https://docs.astro.build/en/guides/fonts
 *
 * 本地字体子集化：在 fontConfig.subsetFonts 中配置对应 cssVariable，
 * 构建时脚本自动扫描页面字符生成轻量 woff2 子集。
 */
import type { FontDefinition, FontSelectionConfig } from "@/types/fontConfig";

// ── Astro Font API 字体定义（修改后需重启开发服务器生效） ──
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
	// ── 本地字体示例 ──
	// 使用步骤：
	// 1. 将 TTF/OTF/WOFF2 字体文件放在 public/assets/fonts/ 目录下
	// 2. 参考下方配置填写正确的字体信息
	// 3. 在 fontConfig.selected 或区域字段中引用 cssVariable
	{
		name: "GreatVibes Regular 2",
		cssVariable: "--font-greatvibes",
		provider: "local",
		options: {
			variants: [
				{
					src: ["./public/assets/fonts/GreatVibes-Regular-2.otf"],
				},
			],
		},
		fallbacks: ["sans-serif"],
	},
];

// ── 字体选择与区域覆盖 ──
export const fontConfig: FontSelectionConfig = {
	// 是否启用自定义字体功能
	enable: true,
	// 当前选择的字体 CSS 变量名（对应上方 fonts 中的 cssVariable）
	// 使用 "system" 表示系统字体（不加载任何自定义字体）
	selected: ["system"],

	// 各区域独立字体设置（填写上方 fonts 中的 cssVariable，留空则使用全局 selected 字体）
	// 例如：bannerTitleFont: "--font-inter", 表示主页横幅主标题使用 Inter 字体
	// 主页横幅主标题字体
	bannerTitleFont: "--font-zen-maru-gothic",
	// 主页横幅副标题字体
	bannerSubtitleFont: "--font-inter",
	// 导航栏标题字体
	navbarTitleFont: "",
	// 代码块字体（用于代码高亮和等宽字体场景）
	codeFont: "--font-jetbrains-mono",

	// 本地字体子集化配置（构建时由 scripts/subset-fonts.ts 处理）
	// key 为 fonts 数组中对应的 cssVariable，value 为子集化选项
	subsetFonts: {
		"--font-greatvibes": {
			// 额外包含的字符
			extraChars: "",
		},
	},
};
