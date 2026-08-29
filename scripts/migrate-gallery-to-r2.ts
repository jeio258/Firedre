#!/usr/bin/env node
/**
 * 将相册配置（src/config/galleryConfig.ts）与 public/gallery/* 图片迁移到 R2
 *
 * 输出:
 *   R2 gallery/index.md           相册 hub（albums 列表）
 *   R2 gallery/{slug}/index.md    相册元数据（frontmatter + photos）
 *   R2 gallery/{slug}/files/*     相册图片文件
 * 照片 URL 改写为 /api/gallery-files/{slug}/{file}（由 Worker 从 R2 流式返回）
 *
 * 用法:
 *   pnpm migrate:gallery / pnpm migrate:gallery:local
 */

import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { BUCKET_NAME, isLocal, remoteFlag, runWrangler } from "./migrate-utils";

const root = process.cwd();

async function loadGalleryConfig() {
	const mod = await import("../src/config/galleryConfig.ts");
	return mod.galleryConfig as {
		albums: Array<{
			id: string;
			name: string;
			description?: string;
			location?: string;
			date?: string;
			tags?: string[];
			password?: string;
			passwordHint?: string;
		}>;
		columnWidth?: number;
	};
}

const gallery = await loadGalleryConfig();
const galleryDir = join(root, "public", "gallery");

const albums: string[] = [];
for (const album of gallery.albums) {
	const slug = album.id;
	const albumDir = join(galleryDir, slug);
	if (!existsSync(albumDir) || !statSync(albumDir).isDirectory()) {
		console.warn(`跳过相册 ${slug}：目录不存在 ${albumDir}`);
		continue;
	}

	// 收集图片文件（排除 urls.txt / cover 之外的常规图片）
	const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;
	const files = readdirSync(albumDir).filter((name) => IMAGE_EXT.test(name));

	const coverFile = files.find((name) => /^cover\./i.test(name)) || null;

	// 上传图片到 R2
	for (const name of files) {
		const file = join(albumDir, name);
		runWrangler([
			"r2",
			"object",
			"put",
			`${BUCKET_NAME}/gallery/${slug}/files/${name}`,
			"--file",
			file,
			remoteFlag(),
		]);
	}

	const photos = files.map((name) => ({
		url: `/api/gallery-files/${slug}/${encodeURIComponent(name)}/`,
		...(name === coverFile ? {} : {}),
	}));

	const frontmatter: Record<string, unknown> = {
		layout: "gallery-album",
		title: album.name,
		desc: album.description || "",
		date: album.date || "",
		location: album.location || "",
		tags: album.tags || [],
		source: "local",
		encrypted: Boolean(album.password),
		...(album.password ? { password: album.password } : {}),
		...(album.passwordHint ? { passwordHint: album.passwordHint } : {}),
		...(coverFile
			? {
					cover: `/api/gallery-files/${slug}/${encodeURIComponent(coverFile)}/`,
				}
			: {}),
		photos,
	};

	const doc = `---\n${YAML.stringify(frontmatter)}---\n`;
	const tmp = join(root, `.migrate-album-${slug}.tmp.md`);
	writeFileSync(tmp, doc, "utf8");
	try {
		runWrangler([
			"r2",
			"object",
			"put",
			`${BUCKET_NAME}/gallery/${slug}/index.md`,
			"--file",
			tmp,
			remoteFlag(),
		]);
	} finally {
		if (existsSync(tmp)) unlinkSync(tmp);
	}

	albums.push(slug);
	console.log(`已迁移相册: ${slug}（${files.length} 张图片）`);
}

// hub
const hubFrontmatter = { layout: "gallery", title: "相册", albums };
const hubDoc = `---\n${YAML.stringify(hubFrontmatter)}---\n`;
const hubTmp = join(root, ".migrate-hub.tmp.md");
writeFileSync(hubTmp, hubDoc, "utf8");
try {
	runWrangler([
		"r2",
		"object",
		"put",
		`${BUCKET_NAME}/gallery/index.md`,
		"--file",
		hubTmp,
		remoteFlag(),
	]);
} finally {
	if (existsSync(hubTmp)) unlinkSync(hubTmp);
}

console.log(`相册迁移完成（${albums.length} 个相册）`);
