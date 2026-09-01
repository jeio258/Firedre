

import type { CloudflareEnv } from "../../types/env";

export interface RateLimitConfig {

	windowMs: number;

	maxRequests: number;

	message?: string;

	failOpen?: boolean;

	scope?: string;
}

export interface RateLimitResult {
	allowed: boolean;

	remaining?: number;

	resetAt?: number;

	retryAfterSec?: number;
}

const defaultConfig: RateLimitConfig = {
	windowMs: 60_000, // 1 分钟
	maxRequests: 60,
	message: "请求过于频繁，请稍后再试",
};

export function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||

		"unknown"
	);
}

export async function checkD1RateLimit(
	db: D1Database,
	key: string,
	config: RateLimitConfig = defaultConfig,
): Promise<RateLimitResult> {
	const now = Date.now();
	const { windowMs, maxRequests } = config;
	// 固定窗口起始
	const windowStart = now - (now % windowMs);

	try {
		const row = await db
			.prepare(
				"SELECT window_started_at, count FROM rate_limits WHERE key = ? AND window_started_at = ?",
			)
			.bind(key, windowStart)
			.first<{ window_started_at: number; count: number }>();

		// 窗口内有记录且已达上限
		if (row && row.count >= maxRequests) {
			return {
				allowed: false,
				retryAfterSec: Math.ceil((windowStart + windowMs - now) / 1000),
				resetAt: windowStart + windowMs,
			};
		}

		await db
			.prepare(`
        INSERT INTO rate_limits (key, kind, window_started_at, count, updated_at)
        VALUES (?, 'window', ?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          window_started_at = excluded.window_started_at,
          count = CASE
            WHEN rate_limits.window_started_at = excluded.window_started_at THEN rate_limits.count + 1
            ELSE 1
          END,
          updated_at = datetime('now')
      `)
			.bind(key, windowStart, 1)
			.run();

		void pruneExpiredWindows(db, now, windowMs).catch(() => {});

		const newCount = (row?.count || 0) + 1;
		return {
			allowed: true,
			remaining: Math.max(0, maxRequests - newCount),
			resetAt: windowStart + windowMs,
		};
	} catch {

		if (config.failOpen === false) {
			return { allowed: false, retryAfterSec: 60 };
		}
		return { allowed: true, remaining: maxRequests };
	}
}

async function pruneExpiredWindows(
	db: D1Database,
	now: number,
	windowMs: number,
) {
	await db
		.prepare("DELETE FROM rate_limits WHERE kind = 'window' AND window_started_at < ?")
		.bind(now - windowMs)
		.run();
}

const memoryStore = new Map<string, { windowStart: number; count: number }>();

export function checkMemoryRateLimit(
	key: string,
	config: RateLimitConfig = defaultConfig,
): RateLimitResult {
	const now = Date.now();
	const { windowMs, maxRequests } = config;
	const windowStart = now - (now % windowMs);

	const row = memoryStore.get(key);
	if (!row || row.windowStart !== windowStart) {
		memoryStore.set(key, { windowStart, count: 1 });
		return {
			allowed: true,
			remaining: maxRequests - 1,
			resetAt: windowStart + windowMs,
		};
	}

	if (row.count >= maxRequests) {
		return {
			allowed: false,
			retryAfterSec: Math.ceil((windowStart + windowMs - now) / 1000),
			resetAt: windowStart + windowMs,
		};
	}

	row.count += 1;
	return {
		allowed: true,
		remaining: maxRequests - row.count,
		resetAt: windowStart + windowMs,
	};
}

export async function withRateLimit<T extends Response>(
	env: CloudflareEnv,
	request: Request,
	config: RateLimitConfig,
	handler: () => Promise<T>,
): Promise<T> {
	const resolvedConfig = config ?? defaultConfig;
	const clientIp = getClientIp(request);
	const scopePart = resolvedConfig.scope ? `${resolvedConfig.scope}:` : "";
	const rateKey = `${scopePart}${clientIp}:${resolvedConfig.windowMs}:${resolvedConfig.maxRequests}`;

	let allowed = true;
	let retryAfter = 0;

	if (env?.DB) {
		const result = await checkD1RateLimit(env.DB, rateKey, resolvedConfig);
		allowed = result.allowed;
		retryAfter = result.retryAfterSec || 0;
	} else {
		const result = checkMemoryRateLimit(rateKey, resolvedConfig);
		allowed = result.allowed;
		retryAfter = result.retryAfterSec || 0;
	}

	if (!allowed) {
		return new Response(
			JSON.stringify({
				message: resolvedConfig.message || defaultConfig.message,
			}),
			{
				status: 429,
				headers: {
					"Content-Type": "application/json; charset=utf-8",
					"Retry-After": String(retryAfter || 1),
					"Cache-Control": "no-store",
				},
			},
		) as T;
	}

	return handler();
}
