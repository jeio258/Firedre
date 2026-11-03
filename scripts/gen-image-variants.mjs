import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// 站点实际请求的候选宽度是 350/640/828/1280/1920，这里取「略大于需求」的阶梯：
// srcset 描述符由组件声明，实际文件只允许比描述符更宽（绝不更窄），否则会变糊
const LADDER = [384, 512, 640, 720, 828, 960, 1280, 1600, 1920];
const AVIF_QUALITY = 60;
const AVIF_EFFORT = 4;
// 收益门槛：小于原图 10% 以上才值得多存一份，否则直接让原图兜底
const MIN_GAIN = 0.9;

const root = fileURLToPath(new URL("..", import.meta.url));
const srcAssets = resolve(root, "src/assets");
const outDir = resolve(root, "public/_img");
const manifestFile = resolve(root, "src/generated/image-variants.ts");
// 缓存只影响生成速度，不影响产物命名（文件名由内容哈希决定，跨机器稳定）
const cacheFile = resolve(
	root,
	"node_modules/.cache/firedre-image-variants.json",
);

const posix = (p) => p.split(sep).join("/");
const shorten = (buffer) =>
	createHash("sha256").update(buffer).digest("hex").slice(0, 8);

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

function loadCache() {
	if (!existsSync(cacheFile)) return {};
	try {
		return JSON.parse(readFileSync(cacheFile, "utf8"));
	} catch {
		return {};
	}
}

async function encode(file, width) {
	return sharp(file)
		.resize({ width, kernel: "lanczos3" })
		.avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
		.toBuffer();
}

async function main() {
	const files = walk(resolve(srcAssets, "images")).filter(
		(f) => extname(f).toLowerCase() === ".avif",
	);

	const cache = loadCache();
	const nextCache = {};
	const manifest = {};
	const kept = new Set();
	const stats = { written: 0, cached: 0, skipped: 0, bytes: 0, before: 0 };

	for (const file of files.sort()) {
		const key = posix(relative(srcAssets, file));
		const meta = await sharp(file).metadata();
		const { size, mtimeMs } = statSync(file);
		const name = posix(relative(resolve(srcAssets, "images"), file)).replace(
			/\.avif$/i,
			"",
		);

		const variants = {};
		for (const width of LADDER) {
			// 原图本身就是这个宽度时不必再生成：同尺寸重编码只会更糊
			if (width > meta.width * 0.9) continue;

			const cacheKey = `${key}|${size}|${mtimeMs}|${width}`;
			const hit = cache[cacheKey];
			let hash = hit?.hash;
			let bytes = hit?.bytes;

			// 无收益的结果也必须进缓存，否则每轮都要重编码一遍「注定被丢弃」的变体
			const reusable =
				hit &&
				(bytes >= size * MIN_GAIN ||
					existsSync(resolve(outDir, `${name}-${width}-${hash}.avif`)));
			if (reusable) {
				stats.cached += 1;
			} else {
				const buffer = await encode(file, width);
				hash = shorten(buffer);
				bytes = buffer.length;
				const outFile = resolve(outDir, `${name}-${width}-${hash}.avif`);
				mkdirSync(dirname(outFile), { recursive: true });
				writeFileSync(outFile, buffer);
				stats.written += 1;
				console.log(
					`  ${key} @${width}: ${(bytes / 1024).toFixed(1)}KB (原图 ${(size / 1024).toFixed(1)}KB)`,
				);
			}

			nextCache[cacheKey] = { hash, bytes };

			const outFile = resolve(outDir, `${name}-${width}-${hash}.avif`);
			if (bytes >= size * MIN_GAIN) {
				stats.skipped += 1;
				rmSync(outFile, { force: true });
				continue;
			}

			kept.add(outFile);
			variants[width] = `/_img/${name}-${width}-${hash}.avif`;
			stats.bytes += bytes;
		}

		if (Object.keys(variants).length > 0) {
			manifest[key] = { width: meta.width, variants };
			stats.before += size;
		}
	}

	// 清掉上一轮遗留（改名或门槛变化后不再使用的产物）
	let removed = 0;
	for (const file of walk(outDir)) {
		if (kept.has(file)) continue;
		rmSync(file, { force: true });
		removed += 1;
	}

	mkdirSync(dirname(manifestFile), { recursive: true });
	writeFileSync(
		manifestFile,
		`// 由 scripts/gen-image-variants.mjs 生成，勿手改
export type ImageVariantSet = {
\twidth: number;
\tvariants: Record<number, string>;
};

export const imageVariants: Record<string, ImageVariantSet> = ${JSON.stringify(manifest, null, "\t")};
`,
	);
	mkdirSync(dirname(cacheFile), { recursive: true });
	writeFileSync(cacheFile, JSON.stringify(nextCache, null, "\t"));

	console.log(
		`[image-variants] 生成 ${stats.written}、复用 ${stats.cached}、跳过 ${stats.skipped}（体积无收益）、清理 ${removed}；` +
			`覆盖 ${Object.keys(manifest).length}/${files.length} 张原图，` +
			`变体合计 ${(stats.bytes / 1024).toFixed(1)}KB（对应原图 ${(stats.before / 1024).toFixed(1)}KB）`,
	);
}

try {
	await main();
} catch (e) {
	// 生成失败不应阻断构建/部署：图片服务对缺失变体逐档回落到原图（等同 passthrough）。
	// 需要严格失败时设 FIREDRE_IMAGE_VARIANTS=strict。
	console.error("[image-variants] 生成失败，本次走原图回退:", e);
	if (process.env.FIREDRE_IMAGE_VARIANTS === "strict") process.exit(1);
}
