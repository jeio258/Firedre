// SharePoster 的纯辅助函数（自组件拆分，原在组件脚本内，无组件状态依赖）。
// 依赖 iconsData / siteConfig / url-utils，与组件解耦后可复用、可单测。

import { url as withBase } from "@shared/utils/url-utils";
import { siteConfig } from "@/config";
import iconsData from "@/constants/icons-data.json";

export function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => {
			if (!src.includes("images.weserv.nl")) {
				const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(src)}&output=png`;
				const proxyImg = new Image();
				proxyImg.crossOrigin = "anonymous";
				proxyImg.onload = () => resolve(proxyImg);
				proxyImg.onerror = () => {
					resolve(null);
				};
				proxyImg.src = proxyUrl;
			} else {
				resolve(null);
			}
		};
		img.src = src;
	});
}

export function resolveImageSource(
	src: string | null,
	selector: string | null,
): string | null {
	if (!selector) return src;
	const image = document.querySelector<HTMLImageElement>(selector);
	return image?.currentSrc || image?.src || src;
}

function serializeNavbarIcon(color: string, size: number): string | null {
	const svg = document.querySelector<SVGSVGElement>("#navbar svg.navbar-logo");
	if (!svg) return null;

	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	// 导航栏图标宽高是 1em，脱离文档后需要显式尺寸才能被 canvas 光栅化
	clone.setAttribute("width", String(size));
	clone.setAttribute("height", String(size));
	clone.removeAttribute("class");
	// 让图标内部的 currentColor 解析成海报里的颜色
	clone.setAttribute("style", `color:${color}`);

	const markup = new XMLSerializer().serializeToString(clone);
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function buildIconDataUrl(icon: string, color: string): string | null {
	const [prefix, name] = icon.split(":");
	if (!prefix || !name) return null;

	const collection = (
		iconsData as Record<
			string,
			{
				icons?: Record<string, { body: string }>;
				width?: number;
				height?: number;
			}
		>
	)[prefix];
	const body = collection?.icons?.[name]?.body;
	if (!body) return null;

	const iconWidth = collection.width ?? 24;
	const iconHeight = collection.height ?? 24;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconWidth}" height="${iconHeight}" viewBox="0 0 ${iconWidth} ${iconHeight}">${body.replaceAll("currentColor", color)}</svg>`;

	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function resolveSiteLogoSource(
	color: string,
	size: number,
): string | null {
	const logo = siteConfig.navbar.logo;
	if (!logo?.value) return null;

	if (logo.type === "icon") {
		return (
			serializeNavbarIcon(color, size) ?? buildIconDataUrl(logo.value, color)
		);
	}

	const navbarLogo =
		document.querySelector<HTMLImageElement>(
			'#navbar img.navbar-logo[data-logo-theme="light"]',
		) ?? document.querySelector<HTMLImageElement>("#navbar img.navbar-logo");
	const navbarLogoSrc = navbarLogo?.currentSrc || navbarLogo?.src;
	if (navbarLogoSrc) return navbarLogoSrc;

	if (logo.type === "url") return logo.value;

	return logo.value.startsWith("/") || logo.value.startsWith("http")
		? withBase(logo.value)
		: null;
}

export function getLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
	const chars = text.split("");
	const lines: string[] = [];
	let currentLine = "";

	for (let i = 0; i < chars.length; i++) {
		const char = chars[i];
		const width = ctx.measureText(currentLine + char).width;
		if (width < maxWidth) {
			currentLine += char;
		} else {
			lines.push(currentLine);
			currentLine = char;
		}
	}
	if (currentLine) {
		lines.push(currentLine);
	}
	return lines;
}

export function fitText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string {
	if (ctx.measureText(text).width <= maxWidth) return text;

	const ellipsis = "...";
	const fittedChars = Array.from(text);
	while (
		fittedChars.length > 0 &&
		ctx.measureText(`${fittedChars.join("")}${ellipsis}`).width > maxWidth
	) {
		fittedChars.pop();
	}

	return fittedChars.length > 0
		? `${fittedChars.join("")}${ellipsis}`
		: ellipsis;
}

export function drawRoundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}
