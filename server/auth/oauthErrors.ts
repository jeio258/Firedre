// OAuth 错误码与文案的单一来源：server 端 302 回跳与登录页客户端共用。
// 本模块必须保持零依赖——LoginCard.svelte 会在客户端 bundle 中引用文案。

export type OAuthErrorCode =
	| "state"
	| "not_configured"
	| "exchange"
	| "no_email"
	| "email_unverified"
	| "banned"
	| "server";

/** 登录页可读的错误码 → 文案 */
export const OAUTH_ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
	state: "登录状态已失效或校验未通过，请重新发起登录",
	not_configured: "该第三方登录尚未配置",
	exchange: "第三方登录验证失败，请稍后再试",
	no_email: "第三方账号没有可用的已验证邮箱，无法登录",
	email_unverified: "第三方账号邮箱未通过验证，无法登录",
	banned: "该账号已被封禁",
	server: "服务器错误，请稍后再试",
};

export function isOAuthErrorCode(v: string): v is OAuthErrorCode {
	return Object.hasOwn(OAUTH_ERROR_MESSAGES, v);
}
