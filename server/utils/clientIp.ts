export function getClientIp(request: Request): string {
	return request.headers.get("CF-Connecting-IP") || "unknown";
}
