export function parseStringList(
	raw: string | null | undefined,
): string[] | undefined {
	if (!raw) return undefined;
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.map(String) : undefined;
	} catch {
		return undefined;
	}
}

export function parseStringListOrEmpty(raw: string | null | undefined): string[] {
	return parseStringList(raw) ?? [];
}
