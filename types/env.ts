export interface CloudflareEnv {
	DB: D1Database;
	BUCKET: R2Bucket;
	WEBDAV_PASSWORD?: string;

	SESSION_SECRET?: string;

	USER_SESSION_SECRET?: string;

	BREVO_API_KEY?: string;
	SMTP_HOST?: string;
	SMTP_PORT?: string;
	SMTP_USER?: string;
	SMTP_PASS?: string;
	SMTP_SECURE?: string;
	MAIL_PROVIDER?: string;
	MAIL_FROM?: string;
	ENVIRONMENT?: string;

	TURNSTILE_SECRET_KEY?: string;

	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
}
