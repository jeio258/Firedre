export interface CloudflareEnv {
	DB: D1Database;
	BUCKET: R2Bucket;
	SESSION?: KVNamespace;
	WEBDAV_PASSWORD?: string;
	ADMIN_USERNAME?: string;
	ADMIN_PASSWORD?: string;
	ADMIN_API_TOKEN?: string;
	/** 会话签名独立密钥（推荐配置，避免直接用 ADMIN_PASSWORD 签名） */
	SESSION_SECRET?: string;
	SITE_URL?: string;
}
