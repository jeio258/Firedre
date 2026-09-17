import { check, startPreview, stopPreview, summary } from "./lib.mjs";

// withAdmin 负向等价验证：未鉴权写请求应 401（与原「verifyAdminRequest→unauthorized」一致）
const { proc, base } = await startPreview();

try {
	const neg = [
		["friends POST", "/api/friends/", "POST", {}],
		["notice PUT", "/api/notice/", "PUT", "x"],
		["about PUT", "/api/about/", "PUT", "x"],
		["dynamics POST", "/api/dynamics/", "POST", { content: "t" }],
		["site-links POST", "/api/site-links/", "POST", {}],
		["site-links DELETE", "/api/site-links/1/", "DELETE", null],
	];
	for (const [name, path, method, body] of neg) {
		const r = await fetch(base + path, {
			method,
			headers: body === null ? {} : { "content-type": "application/json" },
			body:
				body === null
					? undefined
					: typeof body === "string"
						? body
						: JSON.stringify(body),
		});
		check(`负向 ${name} 未鉴权 401`, r.status === 401, `status=${r.status}`);
	}
} finally {
	stopPreview(proc);
}
summary();
