// settingsDefaults 的 extensions 域分组（自 settings-defaults.ts 机械拆分，内容零改动）
export const extensionsDefaults = {
	ads: {
		enabled: false,
		adSenseId: "",
		customCode: "",
	},
	footer: {
		text: "",
		icp: "",
		startYear: "",
		customHtml: "",
		enable: false,
	},
	license: {
		type: "",
		enabled: true,
		name: "CC BY-NC-SA 4.0",
		url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
		icon: "",
	},
} as const;
