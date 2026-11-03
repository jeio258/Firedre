import type { ImageMetadata, LocalImageService } from "astro";
import noop from "astro/assets/services/noop";
import { isESMImportedImage } from "astro/assets/utils";
import { imageVariants } from "../generated/image-variants";

// src/assets 下的图片在构建期由 scripts/gen-image-variants.mjs 预生成多档宽度（public/_img）。
// 这里只改 getURL：把 srcset 各候选指向真实存在的窄图。Cloudflare 运行时没有 sharp，
// 适配器的 compile 模式只作用于预渲染页，本站全 SSR，因此只能构建期预生成。
// 任何一档没有对应产物时一律回落到原图（passthrough 行为），不会出现 404。

const ASSETS_SEGMENT = "/src/assets/";
const BASE = (import.meta.env?.BASE_URL ?? "/").replace(/\/+$/, "");

function resolveVariant(
	src: ImageMetadata | string | undefined,
	width: number | undefined,
): string | null {
	if (!src || !isESMImportedImage(src)) return null;

	const fsPath = (src as { fsPath?: string }).fsPath;
	if (!fsPath) return null;

	const normalized = fsPath.split("\\").join("/");
	const index = normalized.lastIndexOf(ASSETS_SEGMENT);
	if (index === -1) return null;

	const entry = imageVariants[normalized.slice(index + ASSETS_SEGMENT.length)];
	if (!entry) return null;

	// 只允许取「不小于请求宽度」的档位：比描述符更窄的图会被拉伸，等于变糊
	const wanted = width ?? entry.width;
	let best: { width: number; url: string } | null = null;
	for (const [key, url] of Object.entries(entry.variants)) {
		const candidate = Number(key);
		if (candidate < wanted) continue;
		if (!best || candidate < best.width) best = { width: candidate, url };
	}

	return best ? `${BASE}${best.url}` : null;
}

const service: LocalImageService = {
	...noop,
	getURL(options, imageConfig) {
		return (
			resolveVariant(options.src, options.width) ??
			noop.getURL(options, imageConfig)
		);
	},
};

export default service;
