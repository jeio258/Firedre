import { siteConfig } from "@/config";
import {
	BANNER_HEIGHT,
	BANNER_HEIGHT_HOME,
	BANNER_HEIGHT_NON_HOME,
} from "@/constants/constants";
import { isBannerMode } from "@/utils/banner-utils";
import { updateSidebarStickySpacing } from "@/utils/grid-layout-utils";

const stickyNavbar = siteConfig.navbar.stickyNavbar ?? false;
const backToTopBtn = document.getElementById("back-to-top-btn");
const toc = document.getElementById("toc-wrapper");
const navbar = document.getElementById("navbar-wrapper");

export function scrollFunction(): void {
	if (document.documentElement.classList.contains("is-page-transitioning")) {
		return;
	}

	const scrollTop = document.documentElement.scrollTop;
	const bannerHeight = window.innerHeight * (BANNER_HEIGHT / 100);
	const navbarElement = document.getElementById("navbar");

	// 根据滚动位置动态更新侧边栏 sticky 间距
	updateSidebarStickySpacing();

	const operations: (() => void)[] = [];

	if (backToTopBtn) {
		operations.push(() => {
			if (scrollTop > bannerHeight) {
				backToTopBtn.classList.remove("hide");
			} else {
				backToTopBtn.classList.add("hide");
			}
		});
	}

	if (isBannerMode() && toc) {
		operations.push(() => {
			if (scrollTop > bannerHeight) {
				toc.classList.remove("toc-hide");
			} else {
				toc.classList.add("toc-hide");
			}
		});
	}

	if (stickyNavbar && navbar) {
		operations.push(() => {
			navbar.classList.remove("navbar-hidden");
		});
	} else if (isBannerMode() && navbar) {
		operations.push(() => {
			const isHome = document.body.classList.contains("is-home");
			const threshold =
				window.innerHeight *
					((isHome ? BANNER_HEIGHT_HOME : BANNER_HEIGHT_NON_HOME) / 100) -
				88;

			if (scrollTop >= threshold) {
				navbar.classList.add("navbar-hidden");
			} else {
				navbar.classList.remove("navbar-hidden");
			}
		});
	}

	if (navbarElement) {
		operations.push(() => {
			if (scrollTop > 8) {
				navbarElement.classList.add("navbar-sticky-shadow");
			} else {
				navbarElement.classList.remove("navbar-sticky-shadow");
			}
		});
	}

	// 批量执行DOM操作
	if (operations.length > 0) {
		requestAnimationFrame(() => {
			operations.forEach((op) => {
				op();
			});
		});
	}
}

let scrollTimeout: number;

export function initScroll(): void {

	window.addEventListener(
		"scroll",
		() => {
			if (scrollTimeout) {
				cancelAnimationFrame(scrollTimeout);
			}
			scrollTimeout = requestAnimationFrame(scrollFunction);
		},
		{ passive: true },
	);

	// 初始化滚动状态（例如从历史位置恢复时）
	scrollFunction();
}
