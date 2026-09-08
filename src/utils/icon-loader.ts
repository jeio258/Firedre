

let bodyObserver: MutationObserver | null = null;

export function initIconLoader(): void {
	function initContainer(container: Element) {
		if (container.hasAttribute("data-icon-initialized")) return;
		container.setAttribute("data-icon-initialized", "true");

		const loadingIndicator = container.querySelector(
			"[data-loading-indicator]",
		) as HTMLElement;
		const iconElement = container.querySelector(
			"[data-icon-element]",
		) as HTMLElement;
		const iconName = iconElement?.getAttribute("icon");

		if (!loadingIndicator || !iconElement) return;

		function checkIconLoaded() {
			const hasContent =
				iconElement.shadowRoot && iconElement.shadowRoot.children.length > 0;

			if (hasContent) {
				showIcon();
				return true;
			}
			return false;
		}

		function showIcon() {
			loadingIndicator.style.display = "none";
			iconElement.classList.remove("opacity-0");
			iconElement.classList.add("opacity-100");
		}

		function showLoading() {
			loadingIndicator.style.display = "inline-flex";
			iconElement.classList.remove("opacity-100");
			iconElement.classList.add("opacity-0");
		}

		showLoading();

		// 监听图标加载事件
		iconElement.addEventListener("load", () => {
			showIcon();
		});

		// 监听图标加载错误
		iconElement.addEventListener("error", () => {
			// 保持显示fallback
			if (iconName) {
				console.warn(`Failed to load icon: ${iconName}`);
			}
		});

		// 使用MutationObserver监听shadow DOM变化
		if (window.MutationObserver) {
			const observer = new MutationObserver(() => {
				if (checkIconLoaded()) {
					observer.disconnect();
				}
			});

			// 监听iconify-icon元素的变化
			observer.observe(iconElement, {
				childList: true,
				subtree: true,
				attributes: true,
			});

			// 设置超时，避免无限等待
			setTimeout(() => {
				observer.disconnect();
				if (!checkIconLoaded()) {

				}
			}, 5000);
		}

		// 立即检查一次（可能已经加载完成）
		setTimeout(() => {
			checkIconLoaded();
		}, 100);
	}

	document.querySelectorAll("[data-icon-container]").forEach(initContainer);

	bodyObserver?.disconnect();
	if (window.MutationObserver) {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const el = node as Element;
						if (el.hasAttribute?.("data-icon-container")) {
							initContainer(el);
						} else {
							el.querySelectorAll("[data-icon-container]").forEach(
								initContainer,
							);
						}
					}
				});
			});
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
		bodyObserver = observer;
	}
}
