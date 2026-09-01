

export function navigateToPage(
	url: string,
	options?: {
		replace?: boolean;
		force?: boolean;
	},
): void {
	// 检查 URL 是否有效
	if (!url || typeof url !== "string") {
		console.warn("navigateToPage: Invalid URL provided");
		return;
	}

	// 如果是外部链接，直接跳转
	if (
		url.startsWith("http://") ||
		url.startsWith("https://") ||
		url.startsWith("//")
	) {
		window.open(url, "_blank");
		return;
	}

	// 如果是锚点链接，滚动到对应位置
	if (url.startsWith("#")) {
		const element = document.getElementById(url.slice(1));
		if (element) {
			element.scrollIntoView({ behavior: "smooth" });
		}
		return;
	}

	// 检查 Swup 是否可用
	if (typeof window !== "undefined" && window.swup) {
		try {
			// 使用 Swup 进行无刷新跳转
			if (options?.replace) {
				window.swup.navigate(url, { history: false });
			} else {
				window.swup.navigate(url);
			}
		} catch (error) {
			console.error("Swup navigation failed:", error);

			fallbackNavigation(url, options);
		}
	} else {

		fallbackNavigation(url, options);
	}
}

function fallbackNavigation(
	url: string,
	options?: {
		replace?: boolean;
		force?: boolean;
	},
): void {
	if (options?.replace) {
		window.location.replace(url);
	} else {
		window.location.href = url;
	}
}
