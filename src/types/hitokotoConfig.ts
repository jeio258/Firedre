export type HitokotoConfig = {
	/** 一言卡片开关（同时作为侧栏组件开关源） */
	enable: boolean;
	/** 自动轮转开关 */
	rotate: boolean;
	/** 轮转间隔（分钟，最小 1） */
	rotateMinutes: number;
	/** 一言 API 地址 */
	api: string;
	/** 接口不可用时的兜底文案 */
	fallbackText: string;
	/** 兜底文案出处 */
	fallbackSource: string;
};
