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

export { getClientIp as getRequestClientIp } from "../utils/clientIp";

function retryAfterSec(lockedUntil: string) {
	const remainMs = new Date(lockedUntil).getTime() - Date.now();
	return Math.max(1, Math.ceil(remainMs / 1000));
}

function futureLockIso() {
	return new Date(Date.now() + LOGIN_LOCKOUT_MS).toISOString();
}

export function createD1LoginRateLimit(db: D1Database): LoginRateLimitStore {
	const key = (ip: string) => `login:${ip}`;

	return {
		async check(ip) {
			const row = await db
				.prepare(
					"SELECT count AS fail_count, locked_until FROM rate_limits WHERE key = ? AND kind = 'login'",
				)
				.bind(key(ip))
				.first<{ fail_count: number; locked_until: string | null }>();

			if (!row?.locked_until) return { allowed: true };

			if (new Date(row.locked_until).getTime() > Date.now()) {
				return {
					allowed: false,
					retryAfterSec: retryAfterSec(row.locked_until),
				};
			}

			await db.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key(ip)).run();
			return { allowed: true };
		},

		async recordFailure(ip) {
			await db
				.prepare(`
        INSERT INTO rate_limits (key, kind, count, locked_until, updated_at)
        VALUES (?, 'login', 1, NULL, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          count = rate_limits.count + 1,
          locked_until = CASE WHEN rate_limits.count + 1 >= ? THEN ? ELSE rate_limits.locked_until END,
          updated_at = datetime('now')
      `)
				.bind(key(ip), LOGIN_MAX_ATTEMPTS, futureLockIso())
				.run();
		},

		async clear(ip) {
			await db.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key(ip)).run();
		},
	};
}
