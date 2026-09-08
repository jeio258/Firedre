import type { Live2DWidgetConfig, SpineModelConfig } from "../types/pioConfig";

export const spineModelConfig: SpineModelConfig = {
	enable: false,

	model: {
		path: "/pio/models/spine/firefly/1310.json",
		scale: 1.0,
		x: 0,
		y: 0,
	},

	position: {

		corner: "bottom-left",
		offsetX: 0,
		offsetY: 0,
	},

	size: {
		width: 135,
		height: 165,
	},

	interactive: {
		enabled: true,
		clickAnimations: [
			"emoji_0",
			"emoji_1",
			"emoji_2",
			"emoji_3",
			"emoji_4",
			"emoji_5",
		],
		clickMessages: [
			"你好呀！我是流萤~",
			"今天也要加油哦！✨",
			"想要一起去看星空吗？🌟",
			"记得要好好休息呢~",
			"有什么想对我说的吗？💫",
			"让我们一起探索未知的世界吧！🚀",
			"每一颗星星都有自己的故事~⭐",
			"希望能带给你温暖和快乐！💖",
		],
		// 文字显示时间（毫秒）
		messageDisplayTime: 3000,
		idleAnimations: ["idle", "emoji_0", "emoji_1", "emoji_3", "emoji_4"],
		// 待机动画切换间隔（毫秒）
		idleInterval: 8000,
	},

	responsive: {
		hideOnMobile: true,
		mobileBreakpoint: 768,
	},

	zIndex: 1000,

	opacity: 1.0,
};

export const live2dWidgetConfig: Live2DWidgetConfig = {
	enable: false,
	// 模型配置，支持单个模型或数组（多模型切换）
	model: [
		{
			path: "/pio/models/live2d/snow_miku/model.json",
			// 动作声音音量 范围0~1，默认 0（静音）
			volume: 0,
			scale: 1,
			// X轴偏移，范围 -2~2，正值向右
			x: 0,
			// Y轴偏移，范围 -2~2，正值向上
			y: 0,
		},
		{
			// 外部直连模型
			path: "https://model.hacxy.cn/cat-black/model.json",
			volume: 0,
			scale: 1,
			x: 0,
			y: 0,
		},
	],
	// 显示位置：bottom-left 或 bottom-right
	position: "bottom-left" as const,
	// 画布尺寸（px）
	size: { width: 200, height: 200 },

	primaryColor: "var(--l2d-msg-bg)",
	// 入场/退场动画时长（ms）
	transitionDuration: 1500,
	transitionType: "slide" as const,
	menus: {
		// 完全替换默认菜单项
		items: [
			{
				icon: "mdi:home",
				label: "返回主页",
				action: "home",
			},
			{
				icon: "mdi:arrow-up",
				label: "返回顶部",
				action: "scrollToTop",
			},
			{
				icon: "mdi:bed",
				label: "休眠",
				action: "sleep",
			},
			{
				icon: "mdi:swap-horizontal",
				label: "切换模型",
				action: "switchModel",
			},
			{
				icon: "mdi:github",
				label: "GitHub",
				action: "github",
			},
		],
		align: "right" as const,
	},
	tips: {
		enable: true,
		welcomeMessage: ["你好呀！", "欢迎来到我的世界！"],
		messages: [
			"有什么需要帮助的吗？",
			"今天天气真不错呢！",
			"要不要一起玩游戏？",
			"记得按时休息哦！",
		],
		// 文字显示时间（ms）
		duration: 3000,
		// 提示气泡切换间隔（ms）
		interval: 6000,
		// 位置偏移量（px），基于默认位置（模型正上方居中）进行微调
		offset: {
			x: 0,             
			y: 0,             
		},
	},
	responsive: {
		hideOnMobile: true,
		mobileBreakpoint: 768,
	},
};
