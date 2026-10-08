export interface SafeUrlOptions {
	schemes?: string[];

	allowRelative?: boolean;
}

const DEFAULT_SCHEMES = ["http", "https", "mailto", "tel"];
const RELATIVE_PREFIX = /^(\/|\.\/|\.\.\/|#)/;

function isDangerousScheme(value: string, schemes: string[]): boolean {
	if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
	const scheme = value.split(":")[0].toLowerCase();
	return !schemes.includes(scheme);
}

export function safeUrlScheme(
	raw: unknown,
	options: SafeUrlOptions = {},
): string | null {
	if (typeof raw !== "string") return null;

	const value = raw.replace(/[\t\r\n]/g, "").trim();
	if (!value) return null;

	// 协议相对地址（//evil.com）会被解析为当前页面 scheme，是开放重定向/SSRF 向量，默认拒绝
	if (value.startsWith("//")) return null;

	const schemes = options.schemes ?? DEFAULT_SCHEMES;

	// 相对路径（含锚点）
	if (RELATIVE_PREFIX.test(value))
		return options.allowRelative === false ? null : value;

	if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;

	// 带 scheme → 必须在白名单内
	if (isDangerousScheme(value, schemes)) return null;
	return value;
}

export function isSafeHttpUrl(raw: unknown): boolean {
	return safeUrlScheme(raw, { schemes: ["http", "https"] }) !== null;
}

// —— SSRF 防护：代理目标主机的「危险目标阻断」——
// 覆盖私网/环回/链路本地/CGNAT/保留 IPv4、IPv6 环回与 ULA/链路本地/v4-mapped、localhost 与保留 TLD。
// 说明：公网域名解析到私网（DNS rebinding）无法在此静态判定，交由运行平台兜底。
// ponytail: 仅判主机字面量；如需覆盖更多 IPv6 特殊段再补。
const PRIVATE_HOSTNAMES = new Set(["localhost"]);
const PRIVATE_HOST_SUFFIXES = [
	".localhost",
	".local",
	".internal",
	".home.arpa",
];

function isPrivateIPv4(host: string): boolean {
	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (!m) return false;
	const octets = m.slice(1).map(Number);
	if (octets.some((n) => n > 255)) return false;
	const [a, b] = octets;
	return (
		a === 0 || // 0.0.0.0/8
		a === 10 || // 私网
		a === 127 || // 环回
		(a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
		(a === 169 && b === 254) || // 链路本地 / 云元数据
		(a === 172 && b >= 16 && b <= 31) || // 私网
		(a === 192 && b === 168) || // 私网
		a >= 224 // 组播 + 保留
	);
}

function isPrivateIPv6(host: string): boolean {
	const h = host.replace(/^\[|\]$/g, "").toLowerCase();
	if (h === "::" || h === "::1") return true;
	if (/^fe[89ab]/.test(h)) return true; // fe80::/10 链路本地
	if (/^f[cd]/.test(h)) return true; // fc00::/7 ULA
	const mapped = /^::ffff:(.+)$/.exec(h);
	if (mapped) {
		const tail = mapped[1];
		if (isPrivateIPv4(tail)) return true;
		const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail); // ::ffff:7f00:1 形式
		if (hex) {
			const n =
				Number.parseInt(hex[1], 16) * 0x10000 + Number.parseInt(hex[2], 16);
			return isPrivateIPv4(
				`${n >>> 24}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`,
			);
		}
	}
	return false;
}

/** 远程代理目标是否安全：拒绝私网/环回/链路本地/保留主机与保留 TLD（scheme 由调用方另行校验）。 */
export function isSafeProxyTarget(url: URL): boolean {
	const host = url.hostname.toLowerCase().replace(/\.$/, "");
	if (!host) return false;
	if (PRIVATE_HOSTNAMES.has(host)) return false;
	if (PRIVATE_HOST_SUFFIXES.some((s) => host.endsWith(s))) return false;
	if (host.includes(":")) return !isPrivateIPv6(host); // IPv6（URL.hostname 含方括号）
	return !isPrivateIPv4(host);
}
