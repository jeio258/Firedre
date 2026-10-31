// 复制 vditor 运行时资源：构建进 dist/vditor，dev 进 public/vditor（dev 无构建产物，
// 不复制会导致 /vditor/dist/* 404，编辑器在本地完全不渲染）。
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const isDev = process.argv.includes("--dev");
const src = join(root, "node_modules", "vditor", "dist");
const base = isDev
	? join(root, "public", "vditor")
	: join(root, "dist", "vditor");
const dest = join(base, "dist");

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
	readFileSync(stamp, "utf8").trim() === version
) {
	console.log(`[copy-vditor] 已是最新（${version}），跳过`);
	process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
writeFileSync(stamp, `${version}\n`);
console.log(
	`[copy-vditor] ✓ ${version} → ${isDev ? "public/vditor/dist" : "dist/vditor/dist"}`,
);
