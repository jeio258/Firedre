import { describe, expect, it } from "vitest";
import { setAlbumPhotos } from "../server/gallery/service";
import { makeNullD1 } from "./helpers/d1";
import { makeR2 as makeSharedR2, type R2Stub } from "./helpers/r2";

type R2Like = R2Stub;

const makeR2 = (source: string | null): R2Like =>
	makeSharedR2(source === null ? undefined : { "gallery/x/index.md": source });

const envFor = (r2: R2Like) => ({ BUCKET: r2, DB: makeNullD1() as unknown });

describe("setAlbumPhotos", () => {
	it("把图床直链写入 photos，保留其他字段，source 保持 local", async () => {
		const r2 = makeR2(`---
layout: gallery-album
title: "我的相册"
source: local
photos:
  - url: "https://old.example/a.jpg"
---

正文`);
		const photos = [
			{ url: "https://cfbed.sanyue.de/file/1.jpg", type: "image" },
			{ url: "https://cfbed.sanyue.de/file/2.png" },
		];
		await setAlbumPhotos(envFor(r2), "x", photos);

		const updated = r2.store.get("gallery/x/index.md")!;
		expect(updated).toContain("https://cfbed.sanyue.de/file/1.jpg");
		expect(updated).toContain("https://cfbed.sanyue.de/file/2.png");
		expect(updated).toContain('title: "我的相册"');
		expect(updated).toContain('source: "local"');
		// 旧图被替换
		expect(updated).not.toContain("https://old.example/a.jpg");
		// 正文保留
		expect(updated).toContain("正文");
	});

	it("相册不存在时抛 UserError", async () => {
		const r2 = makeR2(null);
		await expect(setAlbumPhotos(envFor(r2), "x", [])).rejects.toThrow(/不存在/);
	});
});
