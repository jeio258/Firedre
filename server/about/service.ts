import type { AboutDetail } from "../../types/about";
import type { CloudflareEnv } from "../../types/env";
import { ABOUT_R2_KEY } from "./constants";
import { getAboutFromSource, normalizeAboutSource } from "./source";

export async function getAbout(
	env: CloudflareEnv,
	options: { includeSource?: boolean } = {},
): Promise<AboutDetail | null> {
	const object = await env.BUCKET.get(ABOUT_R2_KEY);
	if (!object) return null;

	const source = await object.text();
	return getAboutFromSource(source, options);
}

export async function upsertAbout(env: CloudflareEnv, source: string) {
	const normalized = normalizeAboutSource(source);

	await env.BUCKET.put(ABOUT_R2_KEY, normalized, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});

	const detail = await getAboutFromSource(normalized);
	return {
		r2Key: ABOUT_R2_KEY,
		...detail,
	};
}
