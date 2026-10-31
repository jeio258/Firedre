// 复制 vditor 运行时资源：构建进 dist/vditor，dev 进 public/vditor（dev 无构建产物，
// 不复制会导致 /vditor/dist/* 404，编辑器在本地完全不渲染）。
// 落盘路径带版本号（/vditor/<version>/dist/...），引用方经 vite define 的
// __VDITOR_VERSION__ 拼同一来源的版本，升级后旧 URL 天然失效，可安全长缓存。
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const isDev = process.argv.includes("--dev");
const src = join(root, "node_modules", "vditor", "dist");
const base = isDev
	? join(root, "public", "vditor")
	: join(root, "dist", "vditor");

if (!existsSync(src)) {
	console.warn("[copy-vditor] 未找到 node_modules/vditor/dist，跳过");
	process.exit(0);
}

const version = JSON.parse(
	readFileSync(join(root, "node_modules", "vditor", "package.json"), "utf8"),
).version;
const stamp = join(base, ".version");

if (
	isDev &&
	existsSync(stamp) &&
	readFileSync(stamp, "utf8").trim() === version &&
	existsSync(join(base, version, "dist"))
) {
	console.log(`[copy-vditor] 已是最新（${version}），跳过`);
	process.exit(0);
}

mkdirSync(join(base, version), { recursive: true });
// 清掉旧版本目录，避免 dev 的 public 与 build 产物累积多份 24MB 资源
for (const entry of readdirSync(base)) {
	if (entry !== version && entry !== ".version") {
		rmSync(join(base, entry), { recursive: true, force: true });
	}
}
cpSync(src, join(base, version, "dist"), { recursive: true });
writeFileSync(stamp, `${version}\n`);
console.log(
	`[copy-vditor] ✓ ${version} → ${isDev ? "public" : "dist"}/vditor/${version}/dist`,
);
