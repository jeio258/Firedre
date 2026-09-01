/**
 * 恒定时间字符串比较。
 *
 * 用于口令、签名等机密值的比对，避免因逐字符提前返回而泄露长度的时序侧信道。
 * 注意：字符串长度本身非机密，因此长度不等时仍可直接返回 false。
 */
export function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
