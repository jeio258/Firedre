

export function getFailedCovers(key: string): Set<string> {
	try {
		return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
	} catch {
		return new Set();
	}
}

export function markCoverFailed(url: string, key: string): void {
	try {
		const failed = getFailedCovers(key);
		failed.add(url);
		const arr = [...failed];
		localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
	} catch {

	}
}
