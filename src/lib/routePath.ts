export function pathSegments(params: { path?: string }): string[] {
	return (params.path || "").split("/").filter(Boolean);
}
