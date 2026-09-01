
export async function apiJson<T = unknown>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const resp = await fetch(url, {
		credentials: "include",
		...init,
	});
	const data = (await resp.json().catch(() => null)) as
		| (T & { message?: string })
		| null;
	if (!resp.ok) {
		const msg =
			(data && typeof data === "object" && "message" in data
				? (data as { message?: string }).message
				: null) ||
			resp.statusText ||
			String(resp.status);
		throw new Error(msg);
	}
	return data as T;
}
