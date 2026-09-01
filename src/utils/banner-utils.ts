
export function isBannerMode(): boolean {
	return (
		document.documentElement.getAttribute("data-wallpaper-mode") === "banner"
	);
}
