import type { SakuraConfig } from "../types/effectsConfig";

export const sakuraConfig: SakuraConfig = {
	enable: false,

	sakuraNum: 21,

	// 樱花越界限制次数，-1为无限循环
	limitTimes: -1,

	size: {
		min: 0.5,
		max: 1.1,
	},

	opacity: {
		min: 0.3,
		max: 0.9,
	},

	speed: {
		horizontal: {
			min: -1.7,
			max: -1.2,
		},
		vertical: {
			min: 1.5,
			max: 2.2,
		},
		rotation: 0.03,
		// 消失速度，不应大于最小不透明度
		fadeSpeed: 0.03,
	},

	zIndex: 100,
};
