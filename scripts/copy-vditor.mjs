// 复制 vditor 运行时资源进 dist：后台编辑器改用同域路径（/vditor），
// 消除对 jsdelivr 的跨域依赖（国内访问该 CDN 常慢/超时，是编辑器加载慢的主因）。
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const src = join(root, "node_modules", "vditor", "dist");
const dest = join(root, "dist", "vditor", "dist");

if (!existsSync(src)) {
	console.warn("[copy-vditor] 未找到 node_modules/vditor/dist，跳过");
	process.exit(0);
}
mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-vditor] ✓ vditor 资源已复制到 dist/vditor/dist");
