import { pruneBoundedMap } from "@shared/utils/bounded-map";
import type { CloudflareEnv } from "../../types/env";
import { getClientIp } from "./clientIp";

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
		const info = await db
			.prepare(`
        INSERT INTO rate_limits (key, kind, window_started_at, count, updated_at)
        VALUES (?, 'window', ?, 1, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          window_started_at = excluded.window_started_at,
          count = CASE
            WHEN rate_limits.window_started_at = excluded.window_started_at THEN rate_limits.count + 1
            ELSE 1
          END,
          updated_at = datetime('now')
        WHERE rate_limits.window_started_at <> excluded.window_started_at
           OR rate_limits.count < ?
      `)
			.bind(key, windowStart, maxRequests)
			.run();

		if (!info.success) {
			if (config.failOpen === false) {
				return { allowed: false, retryAfterSec: 60 };
			}
			return { allowed: true, remaining: maxRequests };
		}

		if (Number(info.meta?.changes ?? 0) <= 0) {
			return {
				allowed: false,
				retryAfterSec: Math.ceil((windowStart + windowMs - now) / 1000),
				resetAt: windowStart + windowMs,
			};
		}

		pruneExpiredWindowsThrottled(db, now, windowMs);

		return {
			allowed: true,
			resetAt: windowStart + windowMs,
		};
	} catch {
		if (config.failOpen === false) {
			return { allowed: false, retryAfterSec: 60 };
		}
		return { allowed: true, remaining: maxRequests };
	}
}

// 每个放行请求跑一次全表 DELETE 是真实的写放大；改为每个 isolate 至多 60 秒一次。
// 清理只删已过窗的行，被删的键下次插入即重开窗口，计数与锁定结果不受节流影响。
const PRUNE_INTERVAL_MS = 60_000;
let lastPruneAt = 0;

function pruneExpiredWindowsThrottled(
	db: D1Database,
	now: number,
	windowMs: number,
) {
	if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
	// 先占位再发起，避免同 isolate 并发请求一起撞进同一轮清理
	lastPruneAt = now;
	void pruneExpiredWindows(db, now, windowMs).catch(() => {});
}

async function pruneExpiredWindows(
	db: D1Database,
	now: number,
	windowMs: number,
) {
	await db
		.prepare(
			"DELETE FROM rate_limits WHERE kind = 'window' AND window_started_at < ?",
		)
		.bind(now - windowMs)
		.run();
	// 登录失败计数只增不减：已过锁定期或一天未再更新的行一并清掉
	await db
		.prepare(
			"DELETE FROM rate_limits WHERE kind = 'login' AND ((locked_until IS NOT NULL AND locked_until < datetime('now')) OR updated_at < datetime('now', '-1 day'))",
		)
		.run();
}

export const MEMORY_STORE_MAX = 5000;

const memoryStore = new Map<
	string,
	{ windowStart: number; resetAt: number; count: number }
>();

export function checkMemoryRateLimit(
	key: string,
	config: RateLimitConfig = defaultConfig,
): RateLimitResult {
	const now = Date.now();
	const { windowMs, maxRequests } = config;
	const windowStart = now - (now % windowMs);

	pruneBoundedMap(memoryStore, now, MEMORY_STORE_MAX);

	const row = memoryStore.get(key);
	if (!row || row.windowStart !== windowStart) {
		memoryStore.set(key, {
			windowStart,
			resetAt: windowStart + windowMs,
			count: 1,
		});
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
