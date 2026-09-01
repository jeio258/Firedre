const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

const encoder = new TextEncoder();

/**
 * Encrypt HTML content with AES-256-GCM using a PBKDF2-derived key.
 *
 * 安全性：salt 与 IV 每次随机生成；若用 `HMAC(password, slug)` 等确定性派生，
 * 攻击者拿到密文后即可用廉价的 HMAC 校验口令猜测（16 字节比对），完全绕过
 * PBKDF2 的 10 万次迭代成本，使口令保护形同虚设。
 *
 * 输出布局（与客户端解密完全兼容，勿改动）：
 *   base64( salt[16] + iv[12] + authTag[16] + ciphertext )
 *
 * 实现：使用 WebCrypto（crypto.subtle）异步派生/加密，**不阻塞事件循环**。
 * 此前用 `pbkdf2Sync` 100k 迭代属于同步 CPU 密集操作——Cloudflare Workers
 * 对单次请求的同步 CPU 有配额，生产相册页 SSR 每次请求都做一次同步 PBKDF2，
 * 触发配额终止请求 -> 返回空 200（本地 Node 无此配额故正常）。改用异步 WebCrypto
 * 后 PBKDF2/AES 不再计入同步 CPU 配额。
 */
export async function encryptContent(
	html: string,
	password: string,
	_slug: string,
): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits", "deriveKey"],
	);
	const key = await crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		{ name: "AES-GCM", length: KEY_LENGTH * 8 },
		false,
		["encrypt"],
	);
	// WebCrypto AES-GCM 输出 = ciphertext||authTag（校验标签在末尾 16 字节）。
	const combined = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoder.encode(html),
	);
	const combinedBuf = new Uint8Array(combined);
	const authTag = combinedBuf.slice(combinedBuf.length - TAG_LENGTH);
	const ciphertext = combinedBuf.slice(0, combinedBuf.length - TAG_LENGTH);

	const out = new Uint8Array(SALT_LENGTH + IV_LENGTH + TAG_LENGTH + ciphertext.length);
	out.set(salt, 0);
	out.set(iv, SALT_LENGTH);
	out.set(authTag, SALT_LENGTH + IV_LENGTH);
	out.set(ciphertext, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

	// 不依赖 Buffer/node：纯 btoa 编码，Node 与 Workers 均支持
	let bin = "";
	for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
	return btoa(bin);
}
