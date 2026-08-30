import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
	resolve: {
		alias: {
			"@i18n": fileURLToPath(new URL("./src/i18n", import.meta.url)),
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
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
