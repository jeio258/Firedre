import * as path from "node:path";
import type { ImageMetadata } from "astro";
import { profileConfig } from "@/config/profileConfig";
import { siteConfig } from "@/config/siteConfig";
import { defaultFavicons } from "@/constants/icon";
import { url } from "./url-utils";

const projectImages = import.meta.glob<ImageMetadata>(
	"/src/**/*.{png,jpg,jpeg,webp,avif,gif,svg}",
	{ import: "default" },
);

async function loadLocalImage(
	src: string,
	basePath: string,
): Promise<ImageMetadata | null> {
	const rel = src.replace(/^\.\//, "");
	const full = path
		.normalize(path.join(basePath || "", rel))
		.replace(/\\/g, "/");
	const key = `/src/${full}`;
	const loader = projectImages[key];
	if (!loader) {
		console.error(
			`[schema-image] 图片资源未找到: ${key}（src="${src}", basePath="${basePath}"）`,
		);
		return null;
	}
	return loader();
}

export async function toAbsoluteImageInfo(
	src: string | undefined | null,
	basePath: string,
	base: URL | string,
): Promise<{ url: string; width?: number; height?: number } | null> {
	if (!src) return null;
	if (
		src.startsWith("http://") ||
		src.startsWith("https://") ||
		src.startsWith("//") ||
		src.startsWith("data:")
	) {
		return { url: src };
	}
	if (src.startsWith("/")) {
		return { url: new URL(url(src), base).toString() };
	}
	return getLocalImageInfo(src, basePath, base);
}

export async function toAbsoluteImageUrl(
	src: string | undefined | null,
	basePath: string,
	base: URL | string,
): Promise<string | null> {
	return (await toAbsoluteImageInfo(src, basePath, base))?.url ?? null;
}

async function getLocalImageInfo(
	src: string,
	basePath: string,
	base: URL | string,
): Promise<{ url: string; width: number; height: number } | null> {
	const img = await loadLocalImage(src, basePath);
	if (!img) return null;
	return {
		url: new URL(url(img.src), base).toString(),
		width: img.width,
		height: img.height,
	};
}

export async function getAuthorAvatarUrl(): Promise<string | null> {
	return toAbsoluteImageUrl(profileConfig.avatar, "", siteConfig.site_url);
}

// 本地资源静态 hashed URL（不经 _image 按需优化，用于 LCP 首图直接走 CDN 静态文件）
export async function getRawImageUrl(
	src: string,
	basePath = "",
): Promise<string | null> {
	if (!src || src.startsWith("http") || src.startsWith("/") || src.startsWith("data:")) return null;
	const img = await loadLocalImage(src, basePath);
	return img ? img.src : null;
}

// 解析 favicon 的 sizes（如 "192x192"）为宽高
function parseSizes(sizes?: string): { width: number; height: number } | null {
	if (!sizes) return null;
	const m = sizes.match(/^(\d+)x(\d+)$/);
	return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

async function getFaviconAsLogo(): Promise<{
	url: string;
	width?: number;
	height?: number;
} | null> {
	const candidates = [...(siteConfig.favicon || []), ...defaultFavicons];
	if (candidates.length === 0) return null;

	const areas = candidates.map((f) => {
		const d = parseSizes(f.sizes);
		return {
			f,
			w: d?.width ?? 0,
			h: d?.height ?? 0,
			raster: /\.(png|jpe?g|gif)$/i.test(f.src),
		};
	});
	const rasters = areas.filter((c) => c.raster);
	rasters.sort((a, b) => b.w * b.h - a.w * a.h);

	const favicon =
		rasters[0]?.f ||
		[...areas].sort((a, b) => b.w * b.h - a.w * a.h)[0]?.f ||
		candidates[0];
	if (!favicon) return null;

	let logoUrl: string | null;
	if (/^https?:|^\/\//.test(favicon.src) || favicon.src.startsWith("data:")) {
		logoUrl = favicon.src;
	} else if (favicon.src.startsWith("/")) {
		logoUrl = new URL(url(favicon.src), siteConfig.site_url).toString();
	} else {
		logoUrl = await toAbsoluteImageUrl(favicon.src, "", siteConfig.site_url);
	}
	if (!logoUrl) return null;

	const dims = parseSizes(favicon.sizes);
	return {
		url: logoUrl,
		...(dims ? { width: dims.width, height: dims.height } : {}),
	};
}

// 缓存站点 publisher logo 解析结果（构建期静态，只解析一次）
let _siteLogoPromise:
	| Promise<{
			url: string;
			width?: number;
			height?: number;
	  } | null>
	| undefined;

export function getSiteLogo(): Promise<{
	url: string;
	width?: number;
	height?: number;
} | null> {
	if (!_siteLogoPromise) {
		_siteLogoPromise = computeSiteLogo();
	}
	return _siteLogoPromise;
}

async function computeSiteLogo(): Promise<{
	url: string;
	width?: number;
	height?: number;
} | null> {
	const logo = siteConfig.navbar?.logo;
	if (logo) {
		if (logo.type === "url") return { url: logo.value };
		if (logo.type === "image") {
			const info = await getLocalImageInfo(logo.value, "", siteConfig.site_url);
			return info
				? { url: info.url, width: info.width, height: info.height }
				: null;
		}
		// icon 类型无图片 URL → 落到 favicon 兜底
	}
	return getFaviconAsLogo();
}
