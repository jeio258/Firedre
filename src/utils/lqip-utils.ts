import lqipData from "@constants/lqips.json";

const lqips: Record<string, string> = lqipData as Record<string, string>;

const DEFAULT_GRADIENT =
	"linear-gradient(135deg, #d6d3d1 0%, #a8a29e 50%, #d6d3d1 100%)";

function normalizePath(p: string): string {
	return p.replace(/\/\.\//g, "/").replace(/\/+/g, "/");
}

function getLqipGradient(
	src: string,
	basePath?: string,
	isPublic?: boolean,
): string | undefined {
	if (isPublic) {
		// public 图片：key 格式为 public:xxx（去掉开头的 /）
		const relativePath = src.replace(/^\//, "");
		const compact = lqips[`public:${relativePath}`] || lqips[relativePath];
		if (compact?.length !== 18) return undefined;
		const c1 = `#${compact.slice(0, 6)}`;
		const c2 = `#${compact.slice(6, 12)}`;
		const c3 = `#${compact.slice(12, 18)}`;
		return `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
	}

	// src 图片：key 格式为 src:xxx
	const fullPath = basePath ? normalizePath(`${basePath}/${src}`) : src;
	const compact =
		lqips[`src:${fullPath}`] ||
		lqips[`src:${src}`] ||
		lqips[fullPath] ||
		lqips[src];
	if (compact?.length !== 18) return undefined;

	const c1 = `#${compact.slice(0, 6)}`;
	const c2 = `#${compact.slice(6, 12)}`;
	const c3 = `#${compact.slice(12, 18)}`;
	return `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
}

function isExternalImage(src: string): boolean {
	return (
		src.startsWith("http://") ||
		src.startsWith("https://") ||
		src.startsWith("data:")
	);
}

function getLqipStyle(
	src: string,
	basePath?: string,
	isPublic?: boolean,
): string | undefined {
	if (isExternalImage(src)) return undefined;
	const gradient = getLqipGradient(src, basePath, isPublic);
	return gradient ? `background: ${gradient}` : undefined;
}

export function getLqipProps(
	src: string,
	basePath?: string,
	isPublic?: boolean,
): { style: string } {
	if (isExternalImage(src)) return { style: "background: var(--muted)" };
	const style = getLqipStyle(src, basePath, isPublic);
	return { style: style || `background: ${DEFAULT_GRADIENT}` };
}

/**
 * 图片加载完成后的统一收尾：淡入 img（opacity=1）并把它同级容器里的
 * `.lqip-placeholder` 标记为 `loaded`。
 *
 * 共用方：`initImageLoadFadeIn`（全局扫描）与各卡片的 img onload
 * （`MediaCard` / `BilibiliCard` / `BilibiliDetailModal`）——此前四处各写一遍同样的两行。
 */
export function revealLqipImage(img: HTMLImageElement): void {
	img.style.opacity = "1";
	const ph = img.parentElement?.querySelector(".lqip-placeholder");
	if (ph) ph.classList.add("loaded");
}

export function initImageLoadFadeIn(): void {
	const placeholders =
		document.querySelectorAll<HTMLElement>(".lqip-placeholder");
	placeholders.forEach((placeholder) => {
		const container = placeholder.parentElement;
		if (!container) return;
		const img = container.querySelector<HTMLImageElement>("img, picture img");
		if (!img) return;

		if (img.complete && img.naturalWidth > 0) {
			revealLqipImage(img);
		} else {
			img.addEventListener("load", () => revealLqipImage(img), {
				once: true,
			});
			img.addEventListener(
				"error",
				() => {
					if (!container.classList.contains("cover-image-container")) {
						placeholder.classList.add("loaded");
					}
				},
				{ once: true },
			);
		}
	});
}
