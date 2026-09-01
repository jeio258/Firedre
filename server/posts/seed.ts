import type { CloudflareEnv } from "../../types/env";
import { upsertPost } from "./service";
// 构建时内联默认文章源文（Workers 运行时无文件系统）
import firedreSource from "../../posts/firedre.md?raw";

/**
 * 默认文章 seed（仅首次生效）：
 * D1 posts 表为空时导入 posts/firedre.md；非空库直接返回，后续部署不再触发。
 */
export async function ensureDefaultPosts(env: CloudflareEnv): Promise<void> {
	try {
		const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts").first<{
			c: number;
		}>();
		if (row && Number(row.c) > 0) return;
		await upsertPost(env, "firedre", firedreSource);
	} catch {
		/* seed 失败不阻塞请求 */
	}
}
