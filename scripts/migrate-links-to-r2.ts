#!/usr/bin/env node
/**
 * 将友链配置（src/config/friendsConfig.ts）与自定义内容（src/content/spec/friends.mdx）
 * 转换为 AueXUE 格式 links/index.md 并上传 R2
 *
 * 用法:
 *   pnpm migrate:links / pnpm migrate:links:local
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { BUCKET_NAME, isLocal, remoteFlag, runWrangler } from "./migrate-utils";

const root = process.cwd();

async function loadFriendsConfig() {
	const mod = await import("../src/config/friendsConfig.ts");
	return mod.friendsConfig as Array<{
		title: string;
		imgurl: string;
		desc?: string;
		siteurl: string;
		tags?: string[];
		enabled?: boolean;
	}>;
}

const friends = (await loadFriendsConfig())
	.filter((f) => f.enabled !== false)
	.map((f) => ({
		url: f.siteurl,
		avatar: f.imgurl,
		name: f.title,
		desc: f.desc || "",
		tags: f.tags || [],
	}));

const friendsMdxPath = join(root, "src", "content", "spec", "friends.mdx");
const customContent = existsSync(friendsMdxPath)
	? readFileSync(friendsMdxPath, "utf8").replace(
			/^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
			"",
		)
	: "";

const frontmatter = {
	layout: "links",
	title: "来加入我们叭",
	icon: "i-ri-links-line",
	comment: true,
	linkGroups: [
		{
			name: "我的友链",
			links: friends.map(({ tags: _tags, ...rest }) => rest),
		},
	],
};

const doc = `---\n${YAML.stringify(frontmatter)}---\n\n${customContent.trim()}\n`;

const tmpFile = join(root, ".migrate-links-tmp.md");
writeFileSync(tmpFile, doc, "utf8");
try {
	runWrangler([
		"r2",
		"object",
		"put",
		`${BUCKET_NAME}/links/index.md`,
		"--file",
		tmpFile,
		remoteFlag(),
	]);
} finally {
	if (existsSync(tmpFile)) unlinkSync(tmpFile);
}

console.log(`已迁移友链 ${friends.length} 条 → links/index.md`);
