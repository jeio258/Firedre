/**
 * SHA-256 十六进制摘要。
 * 共用方：`auth/adminSession`（密码哈希指纹，改密即吊销旧会话）、
 * `posts/service`（内容寻址的 r2_key）。
 */
export async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(input),
	);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
