

export interface SafeUrlOptions {

	schemes?: string[]

	allowRelative?: boolean
}

const DEFAULT_SCHEMES = ["http", "https", "mailto", "tel"]
const RELATIVE_PREFIX = /^(\/|\.\/|\.\.\/|#)/

function isDangerousScheme(
	value: string,
	schemes: string[],
): boolean {
	if (!/^[a-z][a-z0-9+.-]*:/i.test(value))
		return false
	const scheme = value.split(":")[0].toLowerCase()
	return !schemes.includes(scheme)
}

export function safeUrlScheme(
	raw: unknown,
	options: SafeUrlOptions = {},
): string | null {
	if (typeof raw !== "string")
		return null

	const value = raw.replace(/[\t\r\n]/g, "").trim()
	if (!value)
		return null

	const schemes = options.schemes ?? DEFAULT_SCHEMES

	// 相对路径（含锚点）
	if (RELATIVE_PREFIX.test(value))
		return options.allowRelative === false ? null : value

	if (!/^[a-z][a-z0-9+.-]*:/i.test(value))
		return value

	// 带 scheme → 必须在白名单内
	if (isDangerousScheme(value, schemes))
		return null
	return value
}

export function isSafeHttpUrl(raw: unknown): boolean {
	return safeUrlScheme(raw, { schemes: ["http", "https"] }) !== null
}
