export interface CloudflareEnv {
	DB: D1Database;
	BUCKET: R2Bucket;
	WEBDAV_PASSWORD?: string;
	/** 会话签名独立密钥（必须配置，否则后台无法登录） */
	SESSION_SECRET?: string;
}
