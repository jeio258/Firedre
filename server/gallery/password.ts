import type { CloudflareEnv } from "../../types/env";
import { bumpContentVersion } from "../settings/service";
import { chunkArray, uniqueNonEmpty } from "../utils/collections";
import { UserError } from "../utils/userError";

// 口令静态保护：以 SESSION_SECRET 派生密钥做 AES-GCM 加密后落库，
// D1 数据单独泄露不再直接暴露口令；历史明文值兼容读取（前缀区分），无 secret 时回退明文。
const CIPHER_PREFIX = "enc1:";

// 解密失败哨兵（密钥缺失/密文损坏）：读取方按“已上锁”处理，避免静默放行
export const ALBUM_PASSWORD_DECRYPT_FAILED = "__firedre_decrypt_failed__";

let decryptFailureWarned = false;
function warnDecryptFailure(): void {
	if (decryptFailureWarned) return;
	decryptFailureWarned = true;
	console.warn(
		"[gallery] 相册口令解密失败，已按上锁处理：请检查 SESSION_SECRET 配置或密文数据",
	);
}

const keyCache = globalThis as {
	__FIREDRE_ALBUM_KEY__?: { secret: string; key: Promise<CryptoKey | null> };
};

function getSessionSecret(env: CloudflareEnv): string | null {
	const secret = (env as { SESSION_SECRET?: string }).SESSION_SECRET;
	return typeof secret === "string" && secret.length >= 32 ? secret : null;
}

function getCipherKey(env: CloudflareEnv): Promise<CryptoKey | null> {
	const secret = getSessionSecret(env);
	if (!secret) return Promise.resolve(null);
	const cached = keyCache.__FIREDRE_ALBUM_KEY__;
	if (cached && cached.secret === secret) return cached.key;
	const key = (async (): Promise<CryptoKey | null> => {
		try {
			const material = new TextEncoder().encode(`album-pwd:${secret}`);
			const digest = await crypto.subtle.digest("SHA-256", material);
			return await crypto.subtle.importKey(
				"raw",
				digest,
				{ name: "AES-GCM" },
				false,
				["encrypt", "decrypt"],
			);
		} catch (e) {
			console.warn("[gallery] 相册口令密钥派生失败", e);
			return null;
		}
	})();
	keyCache.__FIREDRE_ALBUM_KEY__ = { secret, key };
	// 派生失败不长期缓存，避免后续请求恒败
	key.then((k) => {
		if (!k && keyCache.__FIREDRE_ALBUM_KEY__?.key === key) {
			delete keyCache.__FIREDRE_ALBUM_KEY__;
		}
	});
	return key;
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
	const raw = atob(s);
	const out = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

async function encryptPassword(
	env: CloudflareEnv,
	plain: string,
): Promise<string | null> {
	const key = await getCipherKey(env);
	// 无可用密钥（缺失或短于 32）时返回 null：拒绝明文落库，由调用方报错
	if (!key) return null;
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		new TextEncoder().encode(plain),
	);
	return `${CIPHER_PREFIX}${toB64(iv)}:${toB64(ct)}`;
}

async function decryptPassword(
	env: CloudflareEnv,
	stored: string,
): Promise<string> {
	if (!stored.startsWith(CIPHER_PREFIX)) return stored;
	const key = await getCipherKey(env);
	if (!key) {
		warnDecryptFailure();
		return ALBUM_PASSWORD_DECRYPT_FAILED;
	}
	const [, ivB64, ctB64] = stored.split(":");
	if (!ivB64 || !ctB64) {
		warnDecryptFailure();
		return ALBUM_PASSWORD_DECRYPT_FAILED;
	}
	try {
		const plain = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: fromB64(ivB64) },
			key,
			fromB64(ctB64),
		);
		return new TextDecoder().decode(plain);
	} catch {
		warnDecryptFailure();
		return ALBUM_PASSWORD_DECRYPT_FAILED;
	}
}

export async function getAlbumPassword(
	env: CloudflareEnv,
	slug: string,
): Promise<string> {
	if (!slug) return "";
	const row = await env.DB.prepare(
		"SELECT password FROM album_passwords WHERE album_slug = ?",
	)
		.bind(slug)
		.first<{ password: string }>();
	return decryptPassword(env, row?.password ?? "");
}

export async function getAlbumPasswordsMap(
	env: CloudflareEnv,
	slugs: string[],
): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	const valid = uniqueNonEmpty(slugs);
	if (!valid.length) return map;

	for (const chunk of chunkArray(valid)) {
		const placeholders = chunk.map(() => "?").join(",");
		const { results } = await env.DB.prepare(
			`SELECT album_slug, password FROM album_passwords WHERE album_slug IN (${placeholders})`,
		)
			.bind(...chunk)
			.all<{ album_slug: string; password: string }>();
		for (const row of results || []) {
			map.set(row.album_slug, await decryptPassword(env, row.password));
		}
	}
	return map;
}

export async function setAlbumPassword(
	env: CloudflareEnv,
	slug: string,
	password: string,
): Promise<void> {
	if (!slug) return;
	const trimmed = String(password || "").trim();
	if (!trimmed) {
		await env.DB.prepare("DELETE FROM album_passwords WHERE album_slug = ?")
			.bind(slug)
			.run();
		await bumpContentVersion(env);
		return;
	}
	const stored = await encryptPassword(env, trimmed);
	// 无密钥/短密钥（<32）拒绝明文降级：口令必须加密落库
	if (stored === null) {
		throw new UserError(
			"SESSION_SECRET 缺失或短于 32 字符，无法加密相册口令，已拒绝明文存储。请配置强随机密钥。",
		);
	}
	await env.DB.prepare(
		`INSERT INTO album_passwords (album_slug, password, updated_at)
		 VALUES (?, ?, datetime('now'))
		 ON CONFLICT(album_slug) DO UPDATE SET password = excluded.password, updated_at = datetime('now')`,
	)
		.bind(slug, stored)
		.run();
	await bumpContentVersion(env);
}

export async function deleteAlbumPassword(
	env: CloudflareEnv,
	slug: string,
): Promise<void> {
	if (!slug) return;
	await env.DB.prepare("DELETE FROM album_passwords WHERE album_slug = ?")
		.bind(slug)
		.run();
	await bumpContentVersion(env);
}
