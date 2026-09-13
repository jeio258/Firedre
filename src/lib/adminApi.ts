export interface ApiError extends Error {
	status?: number;
}

export async function apiJson<T = unknown>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const resp = await fetch(url, {
		credentials: "include",
		...init,
	});
	const data = (await resp.json().catch(() => null)) as
		| (T & { ok?: boolean; message?: string })
		| null;
	const message =
		data && typeof data === "object" && "message" in data
			? (data as { message?: string }).message
			: null;
	if (!resp.ok || (data && typeof data === "object" && data.ok === false)) {
		const err = new Error(
			message || resp.statusText || String(resp.status),
		) as ApiError;
		err.status = resp.status;
		throw err;
	}
	return data as T;
}
