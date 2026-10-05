// 默认「关于页」内容：空 R2（全新部署）首次访问时播种，让访客看到项目介绍。
// 构建时内联源文（Workers 运行时无文件系统），与 posts/seed.ts 同款范式。
import defaultAboutSource from "../../about/index.md?raw";
import type { CloudflareEnv } from "../../types/env";
import { getAbout, upsertAbout } from "./service";

/**
 * 幂等、非破坏性：仅当 R2 尚无 about/index.md 时写入默认内容，
 * 已有内容（用户自己编辑过的）永不覆盖。失败不影响渲染。
 */
export async function ensureDefaultAbout(env: CloudflareEnv): Promise<void> {
	try {
		const existing = await getAbout(env);
		if (existing) return;
		await upsertAbout(env, defaultAboutSource);
	} catch {
		// 播种失败不影响请求（关于页会显示"暂无关于内容"兜底）
	}
}
