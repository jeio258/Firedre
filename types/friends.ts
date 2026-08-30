// 友链数据模型（存 D1）
export interface FriendRecord {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string;
	weight: number;
	enabled: number;
	created_at: string;
	updated_at: string;
}

// 后台编辑 / API 传参的友链字段
export interface FriendInput {
	title: string;
	imgurl: string;
	desc?: string;
	siteurl: string;
	tags?: string[];
	weight?: number;
	enabled?: boolean;
}
