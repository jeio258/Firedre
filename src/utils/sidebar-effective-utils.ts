import { sidebarLayoutConfig } from "@/config";
import {
	generateGridClasses,
	generateMainContentClasses,
	generateRightSidebarClasses,
	generateSidebarClasses,
	getResponsiveSidebarConfig,
	type ResponsiveSidebarConfig,
} from "@/utils/responsive-utils";

export interface EffectiveSidebarContext {
	isPostPage: boolean;
}

export interface EffectiveSidebarState {
	hideSidebarOnPostPage: boolean;
	shouldShowBothSidebarsOnPostPage: boolean;
	shouldAddLeftSidebar: boolean;
	shouldAddRightSidebar: boolean;
	effectiveIsBothSidebars: boolean;
	effectiveHasLeftComponents: boolean;
	effectiveHasRightComponents: boolean;
	effectiveTabletSidebar: "left" | "right";
	mobileShowSidebar: boolean;
	updatedGridConfig: ResponsiveSidebarConfig;
	gridCols: string;
	sidebarClass: string;
	rightSidebarClass: string;
	mainContentClass: string;
	staticBarClass: string;
	footerClassName: string;
}

export function buildFooterClass(config: ResponsiveSidebarConfig): string {
	const footerClass = ["footer", "col-span-1", "onload-animation"];

	if (
		config.isBothSidebars &&
		config.hasLeftComponents &&
		config.hasRightComponents
	) {
		// 双侧栏：Footer 在平板与桌面都跟随内容列
		if (config.tabletSidebar === "right") {
			footerClass.push(
				"md:col-start-1 md:col-span-1 xl:col-start-2 xl:col-span-1",
			);
		} else {
			footerClass.push(
				"md:col-start-2 md:col-span-1 xl:col-start-2 xl:col-span-1",
			);
		}
	} else if (config.hasLeftComponents && !config.hasRightComponents) {
		// 仅左侧栏：内容列在第2列
		footerClass.push(
			"md:col-start-2 md:col-span-1 xl:col-start-2 xl:col-span-1",
		);
	} else {
		// 仅右侧栏或无侧栏：内容列在第1列
		footerClass.push(
			"md:col-start-1 md:col-span-1 xl:col-start-1 xl:col-span-1",
		);
	}

	return footerClass.join(" ");
}

export function getEffectiveSidebarState(
	ctx: EffectiveSidebarContext,
): EffectiveSidebarState {
	const { isPostPage } = ctx;

	const sidebarConfig = getResponsiveSidebarConfig();

	const hideSidebarOnPostPage =
		sidebarLayoutConfig.hideSidebarOnPostPage === true;

	const shouldShowBothSidebarsOnPostPage: boolean =
		sidebarLayoutConfig.enable &&
		!hideSidebarOnPostPage &&
		isPostPage &&
		sidebarLayoutConfig.position !== "both" &&
		!!sidebarLayoutConfig.showBothSidebarsOnPostPage;

	const shouldAddRightSidebar: boolean =
		shouldShowBothSidebarsOnPostPage && sidebarLayoutConfig.position === "left";
	const shouldAddLeftSidebar: boolean =
		shouldShowBothSidebarsOnPostPage &&
		sidebarLayoutConfig.position === "right";

	const effectiveIsBothSidebars: boolean =
		sidebarConfig.isBothSidebars || shouldShowBothSidebarsOnPostPage;
	const effectiveHasRightComponents: boolean =
		sidebarConfig.hasRightComponents ||
		(shouldAddRightSidebar &&
			sidebarLayoutConfig.rightComponents.some((comp) => comp.enable));
	const effectiveHasLeftComponents: boolean =
		sidebarConfig.hasLeftComponents ||
		(shouldAddLeftSidebar &&
			sidebarLayoutConfig.leftComponents.some((comp) => comp.enable));

	const effectiveTabletSidebar = shouldAddLeftSidebar
		? ("right" as const)
		: sidebarConfig.tabletSidebar;

	const updatedGridConfig: ResponsiveSidebarConfig = {
		...sidebarConfig,
		isBothSidebars: effectiveIsBothSidebars,
		hasLeftComponents: effectiveHasLeftComponents,
		hasRightComponents: effectiveHasRightComponents,
		tabletSidebar: effectiveTabletSidebar,
	};

	const { gridCols } = generateGridClasses(updatedGridConfig);
	const sidebarClass = generateSidebarClasses(updatedGridConfig);
	const rightSidebarClass =
		effectiveIsBothSidebars || sidebarLayoutConfig.position === "right"
			? generateRightSidebarClasses(updatedGridConfig)
			: "";
	const mainContentClass = generateMainContentClasses(updatedGridConfig);
	const staticBarClass = mainContentClass.replace("transition-main", "").trim();
	const footerClassName = buildFooterClass(updatedGridConfig);

	return {
		hideSidebarOnPostPage,
		shouldShowBothSidebarsOnPostPage,
		shouldAddLeftSidebar,
		shouldAddRightSidebar,
		effectiveIsBothSidebars,
		effectiveHasLeftComponents,
		effectiveHasRightComponents,
		effectiveTabletSidebar,
		mobileShowSidebar: sidebarConfig.mobileShowSidebar,
		updatedGridConfig,
		gridCols,
		sidebarClass,
		rightSidebarClass,
		mainContentClass,
		staticBarClass,
		footerClassName,
	};
}
