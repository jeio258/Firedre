import type { CloudflareEnv } from "../../types/env";
import { upsertPost } from "./service";
// 构建时内联默认文章源文（Workers 运行时无文件系统）
import firedreSource from "../../posts/firedre.md?raw";

export async function ensureDefaultPosts(env: CloudflareEnv): Promise<void> {
	try {
		const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts").first<{
			c: number;
		}>();
		if (row && Number(row.c) > 0) return;
		await upsertPost(env, "firedre", firedreSource);
	} catch {

	}
}
