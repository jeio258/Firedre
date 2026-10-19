// JS 侧断点单一来源：数值与各 @media / Tailwind 口径对应，调整需同步 CSS
const BREAKPOINT_MOBILE = 768; // 与 Tailwind md: 一致
// 列表/面板默认布局移动阈值：<780 走移动端布局；与 md:768 不同（面板切换更宽）。
// is:inline 脚本无法 import，调用点以注释标注同步
export const BREAKPOINT_LIST_LAYOUT = 780;
export const BREAKPOINT_TABLET = 1024; // 与 Tailwind lg: 一致
export const BREAKPOINT_WIDE = 1200; // 主题面板双列布局阈值
export const BREAKPOINT_COMPACT = 380; // 超窄屏强制网格

export function isMobileViewport(): boolean {
	return typeof window !== "undefined" && window.innerWidth < BREAKPOINT_MOBILE;
}

export function isTabletOrBelowViewport(): boolean {
	return typeof window !== "undefined" && window.innerWidth < BREAKPOINT_TABLET;
}
