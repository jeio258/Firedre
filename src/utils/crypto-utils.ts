import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Encrypt HTML content with AES-256-GCM using a PBKDF2-derived key.
 *
 * 安全要点：salt 与 IV 必须随机生成。若用 `HMAC(password, slug)` 等确定性
 * 派生，攻击者拿到密文后即可用廉价的 HMAC 校验口令猜测（16 字节比对），
 * 完全绕过 PBKDF2 的 10 万次迭代成本，使口令保护形同虚设。
 *
 * 客户端解密时按密文头部读取 salt/iv，因此随机值完全兼容；
 * sessionStorage 缓存的是口令明文而非密文，随机 salt/iv 不影响缓存机制。
 *
 * Output format: base64(salt[16] + iv[12] + authTag[16] + ciphertext)
 */
export function encryptContent(
	html: string,
	password: string,
	_slug: string,
): string {
	const salt = randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);
	const key = pbkdf2Sync(
		password,
		salt,
		PBKDF2_ITERATIONS,
		KEY_LENGTH,
		"sha256",
	);

	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(html, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	const result = Buffer.concat([salt, iv, authTag, encrypted]);
	return result.toString("base64");
}
