import bcrypt from "bcryptjs";
import { constantTimeEqual } from "../utils/timingSafe";

// 管理员与用户共用同一套 bcrypt 参数（$2b$ 10 轮），否则同一密码在两套登录里表现不一致
export const BCRYPT_ROUNDS = 10;

export function isBcryptHash(value: string): boolean {
	return (
		(value.startsWith("$2$") ||
			value.startsWith("$2a$") ||
			value.startsWith("$2b$") ||
			value.startsWith("$2y$")) &&
		value.length === 60
	);
}

export async function hashPassword(
	password: string,
	rounds: number = BCRYPT_ROUNDS,
): Promise<string> {
	return bcrypt.hash(password, rounds);
}

/**
 * 兼容「库里存的是明文」的人工写库场景：明文比对通过后回写 bcrypt（只升级一次）。
 * 回写失败不影响本次校验结果。
 */
export async function verifyPasswordAllowPlaintext(
	plain: string,
	stored: string,
	onUpgrade: (hash: string) => Promise<void> = async () => {},
	rounds: number = BCRYPT_ROUNDS,
): Promise<boolean> {
	if (!plain || !stored) return false;

	if (isBcryptHash(stored)) return bcrypt.compare(plain, stored);

	if (!constantTimeEqual(plain, stored)) return false;

	try {
		await onUpgrade(await hashPassword(plain, rounds));
	} catch {}
	return true;
}
