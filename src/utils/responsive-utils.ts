import { sidebarLayoutConfig } from "@/config";

export interface ResponsiveSidebarConfig {
	isBothSidebars: boolean;
	hasLeftComponents: boolean;
	hasRightComponents: boolean;
	mobileShowSidebar: boolean;
	tabletShowSidebar: boolean;
	desktopShowSidebar: boolean;
	position: "left" | "right" | "both";
	tabletSidebar: "left" | "right";
}

export function getResponsiveSidebarConfig(): ResponsiveSidebarConfig {
	const position = sidebarLayoutConfig.position;
	const tabletSidebar = sidebarLayoutConfig.tabletSidebar ?? "left";

	const isBothSidebars = sidebarLayoutConfig.enable && position === "both";

	// position为right时，左侧组件不参与布局计算
	const hasLeftComponents =
		sidebarLayoutConfig.enable &&
		position !== "right" &&
		sidebarLayoutConfig.leftComponents.some((comp) => comp.enable);

	// position为left时，右侧组件不参与布局计算（即使启用也会被CSS隐藏）
	const hasRightComponents =
		sidebarLayoutConfig.enable &&
		position !== "left" &&
		sidebarLayoutConfig.rightComponents.some((comp) => comp.enable);

	const mobileShowSidebar = false;                  
	const tabletShowSidebar = sidebarLayoutConfig.enable;              
	const desktopShowSidebar = sidebarLayoutConfig.enable;               

	return {
		isBothSidebars,
		hasLeftComponents,
		hasRightComponents,
		mobileShowSidebar,
		tabletShowSidebar,
		desktopShowSidebar,
		position,
		tabletSidebar,
	};
}

export function generateGridClasses(config: ResponsiveSidebarConfig): {
	gridCols: string;
} {
	let gridCols = "grid-cols-1";

	if (
		config.isBothSidebars &&
		config.hasLeftComponents &&
		config.hasRightComponents
	) {
		// 双侧边栏
		if (config.tabletSidebar === "right") {

			gridCols =
				"grid-cols-1 md:grid-cols-[1fr_17.5rem] xl:grid-cols-[17.5rem_1fr_17.5rem]";
		} else {

			gridCols =
				"grid-cols-1 md:grid-cols-[17.5rem_1fr] xl:grid-cols-[17.5rem_1fr_17.5rem]";
		}
	} else if (config.hasLeftComponents && !config.hasRightComponents) {
		// 仅左侧边栏: 769px+显示左+中，768-以下单列
		gridCols = "grid-cols-1 md:grid-cols-[17.5rem_1fr]";
	} else if (!config.hasLeftComponents && config.hasRightComponents) {
		// 仅右侧边栏: 769px+显示中+右，768-以下单列
		gridCols = "grid-cols-1 md:grid-cols-[1fr_17.5rem]";
	}

	return { gridCols };
}

export function generateSidebarClasses(
	config: ResponsiveSidebarConfig,
): string {
	const classes = [
		"mb-4",
		"block",
		"md:col-span-1",
		"md:max-w-70",
		"md:row-start-1",
		"md:row-end-3",
		"md:col-start-1",
		"onload-animation",
	];

	if (config.isBothSidebars && config.tabletSidebar === "right") {
		// 双侧栏+平板端显示右侧栏：左侧栏仅在1280px+显示
		classes.push("xl:block");
	} else {
		// 默认：左侧栏769px+显示
		classes.push("md:block");
	}

	return classes.join(" ");
}

export function generateRightSidebarClasses(
	config: ResponsiveSidebarConfig,
): string {
	const classes = ["mb-4", "hidden", "onload-animation"];

	if (config.isBothSidebars && config.tabletSidebar === "right") {
		// 双侧栏+平板端显示右侧栏：769px+显示右侧栏
		classes.push(
			"md:block",
			"md:row-start-1",
			"md:row-end-3",
			"md:col-span-1",
			"md:max-w-70",
			"md:col-start-2",           
			"xl:col-start-3",           
		);
	} else if (config.isBothSidebars) {
		// 双侧栏+平板端显示左侧栏（默认）：仅1280px+显示
		classes.push(
			"xl:block",
			"xl:row-start-1",
			"xl:row-end-3",
			"xl:col-span-1",
			"xl:max-w-70",
			"xl:col-start-3",
		);
	} else if (config.position === "right") {
		// 仅右侧栏模式（非双侧栏）：769px+显示，在第2列
		classes.push(
			"md:block",
			"md:row-start-1",
			"md:row-end-3",
			"md:col-span-1",
			"md:max-w-70",
			"md:col-start-2",
		);
	} else {
		// 其他情况：仅1280px+显示
		classes.push(
			"xl:block",
			"xl:row-start-1",
			"xl:row-end-3",
			"xl:col-span-1",
			"xl:max-w-70",
			"xl:col-start-3",
		);
	}

	return classes.join(" ");
}

export function generateMainContentClasses(
	config: ResponsiveSidebarConfig,
): string {
	const classes = [
		"transition-main",
		// 768px及以下: 单列布局
		"col-span-1",
	];

	if (
		config.isBothSidebars &&
		config.hasLeftComponents &&
		config.hasRightComponents
	) {
		if (config.tabletSidebar === "right") {
			// 双侧栏+平板端右侧栏: 平板端内容在第1列，桌面端内容在第2列
			classes.push("md:col-span-1");
			classes.push("md:col-start-1");
			classes.push("xl:col-span-1");
			classes.push("xl:col-start-2");
			classes.push("xl:col-end-3");
		} else {
			// 双侧栏+平板端左侧栏（默认）: 内容始终在第2列
			classes.push("md:col-span-1");
			classes.push("md:col-start-2");
			classes.push("xl:col-span-1");
			classes.push("xl:col-start-2");
			classes.push("xl:col-end-3");
		}
	} else if (config.hasLeftComponents && !config.hasRightComponents) {
		// 仅左侧边栏: 内容在第2列
		classes.push("md:col-span-1");
		classes.push("md:col-start-2");
	} else if (!config.hasLeftComponents && config.hasRightComponents) {
		// 仅右侧边栏: 内容在第1列
		classes.push("md:col-span-1");
		classes.push("md:col-start-1");
	} else {
		classes.push("col-span-1");
	}

	classes.push("min-w-0");
	classes.push("overflow-hidden");

	return classes.join(" ");
}
