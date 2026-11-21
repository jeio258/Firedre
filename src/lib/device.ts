// 手机端判定：只认手机 UA，iPad / Android 平板不算（它们的侧栏在宽屏下要显示）。
// 用于 SSR 裁剪手机端永远不可见的侧栏内容——手机端侧栏实测宽高均为 0，
// 但组件仍会被渲染、脚本仍会下载，是移动端请求数与 DOM 的主要浪费项。
// 注意：缓存键必须带上本判定的结果，否则手机与桌面会互相命中同一份 HTML。
export function isPhoneUA(ua: string | null | undefined): boolean {
	if (!ua) return false;
	if (/iPhone|iPod/i.test(ua)) return true;
	if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
	return false;
}
