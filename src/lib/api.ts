import { env } from "cloudflare:workers";
import { UserError } from "../../server/utils/userError";

/**
 * Cloudflare 运行时绑定（D1/R2/环境变量）。
 * 类型由 server 层（tsconfig.server.json + workers-types）校验，此处运行时透传。
 */
// biome-ignore lint/suspicious/noExplicitAny: 见上方注释
export const cfEnv = env as any;

export function json(
	data: unknown,
	status = 200,
	cache: "list" | "default" | "private" = "default",
) {
	const cacheControl =
		status !== 200
			? "no-store"
			: cache === "private"
				? "private, no-store"
				: cache === "list"
					? "public, max-age=0, must-revalidate"
					: "public, max-age=60, stale-while-revalidate=300";

	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": cacheControl,
		},
	});
}

export function unauthorized() {
	return json({ message: "未授权" }, 401);
}

export function methodNotAllowed() {
	return json({ message: "Method not allowed" }, 405);
}

export function notFound(message = "Not found") {
	return json({ message }, 404);
}

export function badRequest(message: string) {
	return json({ message }, 400);
}

export { UserError };

export function serverError(error: unknown) {
	// 仅回显 UserError 的安全消息；其余错误统一回显通用消息，避免泄露内部细节。
	const message =
		error instanceof UserError
			? error.message
			: "服务器错误";
	return json({ message }, 500);
}

/**
 * 统一的 service 错误处理：
 * - UserError（可预期的校验/业务失败）→ 400 并回显安全消息（客户端请求错误）
 * - 其余异常 → 500 通用消息（服务器内部错误，隐藏细节）
 *
 * service 层用 UserError 表达“输入/校验/业务不合法”（如 JSON 解析失败、slug 格式错误、
 * frontmatter 缺字段），API 层用本函数映射为 4xx，而非 500，符合 REST 错误语义。
 */
export function fromServiceError(error: unknown) {
	if (error instanceof UserError) return badRequest(error.message);
	return serverError(error);
}
