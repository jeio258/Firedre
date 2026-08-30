/**
 * API 请求频率限制器
 *
 * Cloudflare Workers 为边缘无状态部署，内存 Map 限流在跨边缘节点/冷启动场景
 * 不可靠。因此：
 * - 生产（有 D1）：使用 D1 持久化限流，跨边缘节点一致，攻击不可绕过。
 * - 本地开发（无 D1）：回退到内存 Map（仅开发环境可接受）。
 */

import type { CloudflareEnv } from "../../types/env";

export interface RateLimitConfig {
	/** 窗口大小（毫秒） */
	windowMs: number;
	/** 窗口内最大请求数 */
	maxRequests: number;
	/** 错误响应消息模板 */
	message?: string;
	/**
	 * D1 故障时的行为：true=放行（默认，可用性优先），false=拒绝（安全优先）。
	 * 安全敏感场景（如相册解锁防暴力破解）应设为 false，避免 D1 故障时防护失效。
	 */
	failOpen?: boolean;
}

export interface RateLimitResult {
	allowed: boolean;
	/** 剩余可用请求数 */
	remaining?: number;
	/** 重置时间（毫秒时间戳） */
	resetAt?: number;
	/** 需等待的秒数（当被限流时） */
	retryAfterSec?: number;
}

const defaultConfig: RateLimitConfig = {
	windowMs: 60_000, // 1 分钟
	maxRequests: 60,
	message: "请求过于频繁，请稍后再试",
};

/**
 * 获取客户端 IP
 */
export function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
		request.headers.get("X-Real-IP") ||
		"unknown"
	);
}

/* ------------------------------------------------------------------ */
/*  D1 持久化限流（生产）                                              */
/* ------------------------------------------------------------------ */

/**
 * 基于 D1 的滑动窗口限流检查。
 * 使用窗口起始时间戳做 key 分片，避免每请求一次 update + 无法并发读。
 * 简单固定窗口实现，配合较短的 windowMs 足够抵御暴力请求。
 */
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
				"SELECT window_started_at, count FROM api_rate_limits WHERE key = ? AND window_started_at = ?",
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

		// 递增计数（原子 UPSERT）。
		// 表主键为 (key)；冲突目标必须是唯一索引/主键的子集，故用单列 (key)。
		// 同窗口则 count+1；若 key 相同但窗口已切换，则重置为当前窗口并 count=1。
		await db
			.prepare(`
        INSERT INTO api_rate_limits (key, window_started_at, count, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          window_started_at = excluded.window_started_at,
          count = CASE
            WHEN api_rate_limits.window_started_at = excluded.window_started_at THEN api_rate_limits.count + 1
            ELSE 1
          END,
          updated_at = datetime('now')
      `)
			.bind(key, windowStart, 1)
			.run();

		// 清理过期窗口（尽力而为，每 ~请求 尝试；量小可忽略）
		// 不阻塞主流程
		void pruneExpiredWindows(db, now, windowMs).catch(() => {});

		const newCount = (row?.count || 0) + 1;
		return {
			allowed: true,
			remaining: Math.max(0, maxRequests - newCount),
			resetAt: windowStart + windowMs,
		};
	} catch {
		// D1 故障：默认 fail-open 保证可用性；安全敏感场景可传 failOpen=false 改为拒绝。
		if (config.failOpen === false) {
			return { allowed: false, retryAfterSec: 60 };
		}
		return { allowed: true, remaining: maxRequests };
	}
}

/**
 * 清理超过当前窗口的旧记录，防止表无限增长。
 */
async function pruneExpiredWindows(
	db: D1Database,
	now: number,
	windowMs: number,
) {
	await db
		.prepare("DELETE FROM api_rate_limits WHERE window_started_at < ?")
		.bind(now - windowMs)
		.run();
}

/* ------------------------------------------------------------------ */
/*  内存限流（本地开发回退）                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  统一入口                                                           */
/* ------------------------------------------------------------------ */

/**
 * 执行带限流的 handler。优先使用 D1（生产可靠），本地无 D1 时回退内存。
 * 返回是否被限流的错误 Response 或 handler 结果。
 */
export async function withRateLimit<T extends Response>(
	env: CloudflareEnv,
	request: Request,
	config: RateLimitConfig,
	handler: () => Promise<T>,
): Promise<T> {
	const resolvedConfig = config ?? defaultConfig;
	const clientIp = getClientIp(request);
	const rateKey = `${clientIp}:${resolvedConfig.windowMs}:${resolvedConfig.maxRequests}`;

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
