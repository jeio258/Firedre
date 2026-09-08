import { coverImageConfig } from "../config/coverImageConfig";
import { siteConfig } from "../config/siteConfig";
import type { ImageFormat } from "../types/config";

function getSeedHash(seed?: string): number {
	return seed
		? Math.abs(
				seed.split("").reduce((acc, char) => {
					return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
				}, 0),
			)
		: 0;
}

function appendSeedParam(apiUrl: string, hash: number): string {
	if (hash === 0) return apiUrl;
	const separator = apiUrl.includes("?") ? "&" : "?";
	return `${apiUrl}${separator}v=${hash}`;
}

export function processCoverImageSync(
	image: string | undefined,
	seed?: string,
	randomCover: typeof coverImageConfig.randomCoverImage = coverImageConfig.randomCoverImage,
): string {
	if (!image || image === "") {
		return "";
	}

	if (image !== "api") {
		return image;
	}

	if (
		!randomCover.enable ||
		!randomCover.apis ||
		randomCover.apis.length === 0
	) {
		return "";
	}

	// 始终使用第一个API，失败时由客户端按顺序尝试后续API
	const hash = getSeedHash(seed);
	return appendSeedParam(randomCover.apis[0], hash);
}

export function getApiUrlList(
	image: string | undefined,
	seed?: string,
	randomCover: typeof coverImageConfig.randomCoverImage = coverImageConfig.randomCoverImage,
): string[] {
	if (image !== "api" || !randomCover.enable || !randomCover.apis) {
		return [];
	}

	const hash = getSeedHash(seed);
	return randomCover.apis.map((api) => appendSeedParam(api, hash));
}

export function getImageFormats(): ImageFormat[] {
	const formatConfig = siteConfig.imageOptimization?.formats ?? "both";
	switch (formatConfig) {
		case "avif":
			return ["avif"];
		case "webp":
			return ["webp"];
		default:
			return ["avif", "webp"];
	}
}

export function getImageQuality(): number {
	return siteConfig.imageOptimization?.quality ?? 80;
}

export function getFallbackFormat(): "avif" | "webp" {
	const formatConfig = siteConfig.imageOptimization?.formats ?? "both";
	return formatConfig === "avif" ? "avif" : "webp";
}

export function shouldAddNoReferrer(urlStr: string): boolean {
	if (!urlStr.startsWith("http")) return false;
	const domains = siteConfig.imageOptimization?.noReferrerDomains || [];
	if (domains.length === 0) return false;
	try {
		const hostname = new URL(urlStr).hostname;
		return domains.some((pattern) => {
			// 先完整转义正则元字符，再把用户写的 * 通配符还原为 .*
			const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const regexPattern = escaped.replace(/\\\*/g, ".*");
			return new RegExp(`^${regexPattern}$`).test(hostname);
		});
	} catch {
		return false;
	}
}
