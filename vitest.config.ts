import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
	resolve: {
		alias: {
			"@i18n": fileURLToPath(new URL("./src/i18n", import.meta.url)),
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"@constants": fileURLToPath(new URL("./src/constants", import.meta.url)),
		},
	},
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			// 仅统计实际被测覆盖的模块，避免纯浏览器 utils 长期拉低报告
			include: [
				"server/**/*.ts",
				"src/utils/client-settings.ts",
				"src/utils/schema-utils.ts",
				"src/utils/setting-utils.ts",
				"src/config/**/*.ts",
				"utils/**/*.ts",
			],
		},
	},
});
