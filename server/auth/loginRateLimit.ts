import type { IncomingMessage } from "node:http";

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export interface LoginRateLimitCheck {
	allowed: boolean;
	retryAfterSec?: number;
}

export interface LoginRateLimitStore {
	check(ip: string): Promise<LoginRateLimitCheck>;
	recordFailure(ip: string): Promise<void>;
	clear(ip: string): Promise<void>;
}

export function formatLoginRateLimitMessage(retryAfterSec: number) {
	const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
	return `登录尝试过多，请 ${minutes} 分钟后再试`;
}

export function getRequestClientIp(request: Request) {
	return (
		request.headers.get("CF-Connecting-IP") ||
		// 仅信任 Cloudflare 设置的连接 IP；不信任可被客户端伪造的 X-Forwarded-For
		"unknown"
	);
}

export function getHttpClientIp(req: IncomingMessage) {
	const forwarded = req.headers["x-forwarded-for"];
	if (typeof forwarded === "string" && forwarded.trim())
		return forwarded.split(",")[0].trim();
	return req.socket.remoteAddress || "unknown";
}

function retryAfterSec(lockedUntil: string) {
	const remainMs = new Date(lockedUntil).getTime() - Date.now();
	return Math.max(1, Math.ceil(remainMs / 1000));
}

function futureLockIso() {
	return new Date(Date.now() + LOGIN_LOCKOUT_MS).toISOString();
}

export function createD1LoginRateLimit(db: D1Database): LoginRateLimitStore {
	return {
		async check(ip) {
			const row = await db
				.prepare(
					"SELECT fail_count, locked_until FROM admin_login_attempts WHERE ip = ?",
				)
				.bind(ip)
				.first<{ fail_count: number; locked_until: string | null }>();

			if (!row?.locked_until) return { allowed: true };

			if (new Date(row.locked_until).getTime() > Date.now()) {
				return {
					allowed: false,
					retryAfterSec: retryAfterSec(row.locked_until),
				};
			}

			await db
				.prepare("DELETE FROM admin_login_attempts WHERE ip = ?")
				.bind(ip)
				.run();
			return { allowed: true };
		},

		async recordFailure(ip) {
			const row = await db
				.prepare("SELECT fail_count FROM admin_login_attempts WHERE ip = ?")
				.bind(ip)
				.first<{ fail_count: number }>();

			const failCount = (row?.fail_count || 0) + 1;
			const lockedUntil =
				failCount >= LOGIN_MAX_ATTEMPTS ? futureLockIso() : null;

			await db
				.prepare(`
        INSERT INTO admin_login_attempts (ip, fail_count, locked_until)
        VALUES (?, ?, ?)
        ON CONFLICT(ip) DO UPDATE SET
          fail_count = excluded.fail_count,
          locked_until = excluded.locked_until
      `)
				.bind(ip, failCount, lockedUntil)
				.run();
		},

		async clear(ip) {
			await db
				.prepare("DELETE FROM admin_login_attempts WHERE ip = ?")
				.bind(ip)
				.run();
		},
	};
}

type MemoryRow = { failCount: number; lockedUntil: number | null };

export function createMemoryLoginRateLimit(): LoginRateLimitStore {
	const rows = new Map<string, MemoryRow>();

	return {
		async check(ip) {
			const row = rows.get(ip);
			if (!row?.lockedUntil) return { allowed: true };

			if (row.lockedUntil > Date.now()) {
				return {
					allowed: false,
					retryAfterSec: Math.max(
						1,
						Math.ceil((row.lockedUntil - Date.now()) / 1000),
					),
				};
			}

			rows.delete(ip);
			return { allowed: true };
		},

		async recordFailure(ip) {
			const row = rows.get(ip) || { failCount: 0, lockedUntil: null };
			row.failCount += 1;
			if (row.failCount >= LOGIN_MAX_ATTEMPTS)
				row.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
			rows.set(ip, row);
		},

		async clear(ip) {
			rows.delete(ip);
		},
	};
}

let localMemoryStore: LoginRateLimitStore | null = null;

export function getLocalLoginRateLimitStore() {
	if (!localMemoryStore) localMemoryStore = createMemoryLoginRateLimit();
	return localMemoryStore;
}
