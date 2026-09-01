import { backgroundWallpaper } from "../config";

export type BackgroundImages = {
	desktop: string[];
	mobile: string[];
	isMultiple: boolean;
};

// 将单个值或数组统一为数组
const toArray = (src: string | string[] | undefined): string[] => {
	if (!src) return [];
	if (Array.isArray(src)) return src;
	return [src];
};

// 背景图片处理工具函数
// 返回所有配置的图片（用于构建时渲染所有图片）
export const getBackgroundImages = (): BackgroundImages => {
	const bgSrc = backgroundWallpaper.src;

	if (
		typeof bgSrc === "object" &&
		bgSrc !== null &&
		!Array.isArray(bgSrc) &&
		("desktop" in bgSrc || "mobile" in bgSrc)
	) {
		const srcObj = bgSrc as {
			desktop?: string | string[];
			mobile?: string | string[];
		};
		const desktopImages = toArray(srcObj.desktop);
		const mobileImages = toArray(srcObj.mobile);
		return {
			desktop: desktopImages.length > 0 ? desktopImages : mobileImages,
			mobile: mobileImages.length > 0 ? mobileImages : desktopImages,
			isMultiple: desktopImages.length > 1 || mobileImages.length > 1,
		};
	}
	// 如果是字符串或数组，同时用于桌面端和移动端
	const images = toArray(bgSrc as string | string[]);
	return {
		desktop: images,
		mobile: images,
		isMultiple: images.length > 1,
	};
};

// 检查是否为首页
export const isHomePage = (pathname: string): boolean => {
	// 获取 base URL
	const baseUrl = import.meta.env.BASE_URL || "/";
	const baseUrlNoSlash = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

	if (pathname === baseUrl) return true;
	if (pathname === baseUrlNoSlash) return true;
	if (pathname === "/") return true;

	return false;
};
