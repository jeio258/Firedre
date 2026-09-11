export interface FetchRetryOptions {
	timeoutMs?: number;
	retries?: number;
	backoffMs?: number;
}

/** 外部请求包装：网络错误/5xx/429 时退避重试（幂等查询用），超时每次尝试独立计时 */
export async function fetchWithRetry(
	url: string,
	init: RequestInit = {},
	{
		timeoutMs = 10_000,
		retries = 1,
		backoffMs = 300,
	}: FetchRetryOptions = {},
): Promise<Response> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		if (attempt > 0) {
			await new Promise((r) => setTimeout(r, backoffMs * attempt));
		}
		try {
			const response = await fetch(url, {
				...init,
				signal: AbortSignal.timeout(timeoutMs),
			});
			if (response.status < 500 && response.status !== 429) return response;
			if (attempt >= retries) return response;
			lastError = new Error(`上游状态码 ${response.status}`);
		} catch (e) {
			lastError = e;
			if (attempt >= retries) throw e;
		}
	}
	throw lastError;
}
