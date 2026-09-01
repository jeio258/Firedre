export interface CloudflareEnv {
	DB: D1Database;
	BUCKET: R2Bucket;
	WEBDAV_PASSWORD?: string;

	SESSION_SECRET?: string;
}
