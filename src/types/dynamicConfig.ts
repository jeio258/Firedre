/** 字段含义详见 src/config/dynamicConfig.ts */
export type DynamicConfig = {
	title?: string;
	description?: string;
	profileUrl?: string;
	showComment?: boolean;
	itemsPerPage?: number;
	apiUrl?: string;
	memos?: DynamicMemosConfig;
};

export type DynamicMemosConfig = {
	/** 是否启用 Memos 数据源 */
	enable: boolean;
	/** Memos 实例地址，如 "https://memos.example.com" */
	apiUrl: string;
	/** Memos 用户标识，如 "users/xiaye"，用于过滤指定用户的动态 */
	parent?: string;
};
