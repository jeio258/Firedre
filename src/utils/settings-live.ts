// 设置实时感知（L2，总指令：动态为唯一主路径）：
// 后台设置变更（版本号递增）后，已打开的页面在前台/导航时拉取最新客户端设置，
// 原地更新 window.__FIREFLY_SETTINGS__ 并派发事件——消费方据此实时重读。
const versionAttr = "data-settings-version";
const EVENT = "firedre:settings-changed";

let currentVersion = document.documentElement.getAttribute(versionAttr) ?? "";
let checking = false;

export function getClientSettingsVersion(): string {
	return currentVersion;
}

/** 比对设置版本；有变化则原地更新注入对象并派发事件。返回是否发生更新。 */
export async function checkSettingsChanged(): Promise<boolean> {
	if (checking) return false;
	checking = true;
	try {
		const resp = await fetch("/api/settings/client", { cache: "no-store" });
		if (!resp.ok) return false;
		const data = (await resp.json()) as {
			version?: string;
			settings?: Record<string, unknown>;
		};
		if (!data.version || data.version === currentVersion) return false;
		currentVersion = data.version;
		(window as { __FIREFLY_SETTINGS__?: unknown }).__FIREFLY_SETTINGS__ =
			data.settings ?? {};
		document.dispatchEvent(
			new CustomEvent(EVENT, { detail: { version: currentVersion } }),
		);
		return true;
	} catch {
		return false;
	} finally {
		checking = false;
	}
}

// 触发时机：标签页回到前台 / Swup 软导航完成（活跃浏览场景实时感知）
document.addEventListener("visibilitychange", () => {
	if (!document.hidden) void checkSettingsChanged();
});
// astro:page-load 由 Swup 集成在每次软导航后派发（活跃浏览场景实时感知）
document.addEventListener("astro:page-load", () => {
	void checkSettingsChanged();
});
