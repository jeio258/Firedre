import { env } from "cloudflare:workers";
import { UserError } from "../../server/utils/userError";

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

	const message =
		error instanceof UserError
			? error.message
			: "服务器错误";
	return json({ message }, 500);
}

export function fromServiceError(error: unknown) {
	if (error instanceof UserError) return badRequest(error.message);
	return serverError(error);
}
