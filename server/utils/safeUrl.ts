/**
 * URL scheme 安全校验（服务端 + 浏览器共用的纯函数，无环境依赖）。
 *
 * 统一「拦截 javascript:/data:/vbscript: 等危险 scheme」的逻辑，替代原先分散在
 * posts/friends/notice/memos/sanitize-html 的多份重复实现。
 *
 * 规则要点：
 * - 默认拦截一切带明确 scheme 的 URL，仅放行白名单 scheme（http/https/mailto/tel）。
 * - 相对地址（/ ./ ../ # 或以字母开头但无 ":" 的普通路径）按配置放行。
 * - 先剔除 scheme 内的 ASCII 控制字符（tab/CR/LF），防止 `java\tscript:` 混淆绕过。
 */

export interface SafeUrlOptions {
	/** 允许的 scheme 白名单（不含 ":"，如 ["https"]）。默认 http/https/mailto/tel */
	schemes?: string[]
	/** 相对路径（/ ./ ../ #）是否放行。默认 true */
	allowRelative?: boolean
}

const DEFAULT_SCHEMES = ["http", "https", "mailto", "tel"]
const RELATIVE_PREFIX = /^(\/|\.\/|\.\.\/|#)/

/** 是否为「危险 scheme」，即带明确 scheme 但不在白名单内 */
function isDangerousScheme(
	value: string,
	schemes: string[],
): boolean {
	if (!/^[a-z][a-z0-9+.-]*:/i.test(value))
		return false
	const scheme = value.split(":")[0].toLowerCase()
	return !schemes.includes(scheme)
}

/**
 * 校验 URL scheme 是否安全。
 * @returns 安全返回原始值（已剔除控制字符并 trim），危险返回 null。
 */
export function safeUrlScheme(
	raw: unknown,
	options: SafeUrlOptions = {},
): string | null {
	if (typeof raw !== "string")
		return null
	// 剔除 scheme 内 ASCII 控制字符，防止 java\tscript: 混淆绕过
	const value = raw.replace(/[\t\r\n]/g, "").trim()
	if (!value)
		return null

	const schemes = options.schemes ?? DEFAULT_SCHEMES

	// 相对路径（含锚点）
	if (RELATIVE_PREFIX.test(value))
		return options.allowRelative === false ? null : value

	// 无 scheme 的普通路径（如 www.example.com）→ 视为相对，安全
	if (!/^[a-z][a-z0-9+.-]*:/i.test(value))
		return value

	// 带 scheme → 必须在白名单内
	if (isDangerousScheme(value, schemes))
		return null
	return value
}

/** 仅 http/https（含相对路径），用于友链/头像等需要真实网页地址的场景 */
export function isSafeHttpUrl(raw: unknown): boolean {
	return safeUrlScheme(raw, { schemes: ["http", "https"] }) !== null
}
