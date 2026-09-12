export const DB_IN_CHUNK = 100;

export function chunkArray<T>(items: T[], size = DB_IN_CHUNK): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

export function uniqueNonEmpty(items: (string | null | undefined)[]): string[] {
	return [...new Set(items.filter((item): item is string => Boolean(item)))];
}
