import type { CoverImageConfig } from "../types/coverImageConfig";

export const coverImageConfig: CoverImageConfig = {
	enableInPost: true,

	enableInPostOverlay: false,

	// 是否显示转圈圈加载动画，会替代掉LQIP
	showLoading: false,

	randomCoverImage: {
		enable: false,
		apis: [
			"https://t.alcy.cc/pc",
			"https://www.dmoe.cc/random.php",
			"https://uapis.cn/api/v1/random/image?category=acg&type=pc",
		],
	},
};
