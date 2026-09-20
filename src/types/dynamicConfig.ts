export type DynamicConfig = {
	title?: string;
	description?: string;
	profileUrl?: string;
	showComment?: boolean;
	itemsPerPage?: number;
	apiUrl?: string;
	memos?: DynamicMemosConfig;
	enable?: boolean;
};

export type DynamicMemosConfig = {
	enable: boolean;

	apiUrl: string;

	parent?: string;
};
