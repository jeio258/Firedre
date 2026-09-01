import { describe, expect, it } from "vitest";
import {
	updateGalleryAlbumOrder,
	upsertGalleryAlbum,
} from "../server/gallery/service";

const HUB_KEY = "gallery/index.md";

interface R2Like {
	store: Map<string, string>;
	get(key: string): Promise<{ text(): Promise<string> } | null>;
	put(key: string, body: string): Promise<void>;
}

function makeR2(initial: Record<string, string>): R2Like {
	const store = new Map(Object.entries(initial));
	return {
		store,
		async get(key: string) {
			const v = store.get(key);
			if (!v) return null;
			return { text: async () => v };
		},
		async put(key: string, body: string) {
			store.set(key, body);
		},
	};
}

const dbStub = {
	prepare() {
		return {
			bind() {
				return {
					async first() {
						return null;
					},
					async run() {
						return {};
					},
				};
			},
		};
	},
};

const envFor = (r2: R2Like) => ({ BUCKET: r2, DB: dbStub });

const hubSource = `---
layout: gallery
title: 相册
albums:
  - existing-album
---

# 相册
`;

const albumSource = (slug: string, title: string) =>
	`---
layout: gallery-album
title: ${title}
source: local
---

正文 ${slug}
`;

function albumsIn(r2: R2Like): string[] {
	const hub = r2.store.get(HUB_KEY);
	if (!hub) return [];
	const fm = hub.split("---")[1] || "";
	const match = fm.match(/albums:\n([\s\S]*?)(?=\n\S|$)/);
	if (!match) return [];
	return Array.from(match[1].matchAll(/^\s*-\s+(.+?)\s*$/gm)).map((m) =>
		m[1].trim().replace(/^"|"$/g, "").trim(),
	);
}

describe("upsertGalleryAlbum 创建相册自动进列表", () => {
	it("创建新相册时，slug 自动追加到 hub albums 末尾", async () => {
		const r2 = makeR2({ [HUB_KEY]: hubSource });
		const env = envFor(r2);

		await upsertGalleryAlbum(env, "new-album", albumSource("new-album", "新相册"));

		expect(albumsIn(r2)).toEqual(["existing-album", "new-album"]);
		// 相册文件确实写入
		expect(r2.store.has("gallery/new-album/index.md")).toBe(true);
	});

	it("已存在的相册保存时不重复加入列表、不改顺序", async () => {
		const r2 = makeR2({ [HUB_KEY]: hubSource });
		const env = envFor(r2);

		await upsertGalleryAlbum(env, "existing-album", albumSource("existing-album", "已有"));

		expect(albumsIn(r2)).toEqual(["existing-album"]);
	});
});

describe("updateGalleryAlbumOrder 排序", () => {
	it("按给定顺序更新 albums，过滤不存在的相册、去重", async () => {
		const r2 = makeR2({
			[HUB_KEY]: hubSource,
			"gallery/existing-album/index.md": albumSource("existing-album", "已有"),
			"gallery/other/index.md": albumSource("other", "另一个"),
		});
		const env = envFor(r2);

		const result = await updateGalleryAlbumOrder(env, [
			"other",
			"existing-album",
			"ghost-not-exist",
			"other",
		]);

		expect(result.albums.map((a) => a.slug)).toEqual(["other", "existing-album"]);
		expect(albumsIn(r2)).toEqual(["other", "existing-album"]);
	});

	it("空 slug 数组时清空列表", async () => {
		const r2 = makeR2({ [HUB_KEY]: hubSource });
		const env = envFor(r2);

		await updateGalleryAlbumOrder(env, []);

		expect(albumsIn(r2)).toEqual([]);
	});
});
