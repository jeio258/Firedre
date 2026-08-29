import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["server/**/*.ts", "src/utils/*.ts"],
			exclude: [
				"server/auth/adminSession.ts", // 需要 Cloudflare 环境
			],
		},
	},
});
