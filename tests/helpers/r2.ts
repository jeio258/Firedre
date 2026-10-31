export interface R2Stub {
	store: Map<string, string>;
	get(key: string): Promise<{ text(): Promise<string> } | null>;
	put(key: string, body: string): Promise<void>;
	delete(key: string): Promise<void>;
}

export function makeR2(initial?: Record<string, string>): R2Stub {
	const store = new Map(Object.entries(initial ?? {}));
	return {
		store,
		async get(key) {
			const value = store.get(key);
			return value === undefined ? null : { text: async () => value };
		},
		async put(key, body) {
			store.set(key, body);
		},
		async delete(key) {
			store.delete(key);
		},
	};
}
