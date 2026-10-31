import { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import {
	getAlbumFromD1,
	getAlbumsFromD1Map,
	upsertAlbumToD1,
} from "../server/gallery/d1";
import { type D1Like, makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

let db: DatabaseSync;
let env: { DB: D1Like };

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	applyMigrations(db, ["0001_init.sql"]);
	env = { DB: makeD1(db) };
});

describe("相册 D1 数据层", () => {
	it("upsert 写入元数据 + 照片，get 读回结构一致", async () => {
		await upsertAlbumToD1(
			env,
			"test-album",
			{
				title: "我的相册",
				desc: "测试描述",
				date: "2026-08-31",
				location: "杭州市",
				tags: ["旅行", "风景"],
				cover: "https://x/cover.jpg",
				encrypted: true,
				source: "local",
				photos: [
					{ url: "https://x/1.jpg", type: "image" },
					{
						url: "https://x/video.mp4",
						type: "video",
						poster: "https://x/p.jpg",
					},
					{ url: "https://x/2.jpg" },
				],
			},
			"# 正文内容",
		);

		const data = await getAlbumFromD1(env, "test-album");
		expect(data).not.toBeNull();
		expect(data!.frontmatter.title).toBe("我的相册");
		expect(data!.frontmatter.desc).toBe("测试描述");
		expect(data!.frontmatter.date).toBe("2026-08-31");
		expect(data!.frontmatter.location).toBe("杭州市");
		expect(data!.frontmatter.tags).toEqual(["旅行", "风景"]);
		expect(data!.frontmatter.cover).toBe("https://x/cover.jpg");
		expect(data!.frontmatter.encrypted).toBe(true);
		expect(data!.frontmatter.source).toBe("local");
		expect(data!.frontmatter.photos).toHaveLength(3);
		// 排序保持插入顺序
		expect(data!.frontmatter.photos![0].url).toBe("https://x/1.jpg");
		expect(data!.frontmatter.photos![2].url).toBe("https://x/2.jpg");
		expect(data!.content).toBe("# 正文内容");
	});

	it("upsert 覆盖已有相册并更新照片列表", async () => {
		await upsertAlbumToD1(
			env,
			"test-album",
			{
				title: "改后",
				source: "local",
				photos: [{ url: "https://x/new.jpg" }],
			},
			"新正文",
		);
		const data = await getAlbumFromD1(env, "test-album");
		expect(data!.frontmatter.title).toBe("改后");
		expect(data!.frontmatter.photos).toHaveLength(1);
		expect(data!.frontmatter.photos![0].url).toBe("https://x/new.jpg");
		expect(data!.content).toBe("新正文");
	});

	it("delete 级联删除照片", async () => {
		await env.DB.prepare("DELETE FROM albums WHERE slug = ?")
			.bind("test-album")
			.run();
		const data = await getAlbumFromD1(env, "test-album");
		expect(data).toBeNull();
	});

	it("不存在的相册返回 null", async () => {
		expect(await getAlbumFromD1(env, "does-not-exist")).toBeNull();
	});

	it("getAlbumsFromD1Map 批量读取与逐个一致", async () => {
		await upsertAlbumToD1(
			env,
			"batch-a",
			{ title: "A", source: "local", photos: [{ url: "https://x/a1.jpg" }] },
			"A 正文",
		);
		await upsertAlbumToD1(
			env,
			"batch-b",
			{
				title: "B",
				source: "local",
				photos: [{ url: "https://x/b1.jpg" }, { url: "https://x/b2.jpg" }],
			},
			"B 正文",
		);

		const map = await getAlbumsFromD1Map(env as never, [
			"batch-a",
			"batch-b",
			"missing",
		]);
		expect(map.has("missing")).toBe(false);
		expect(map.get("batch-a")).toEqual(await getAlbumFromD1(env, "batch-a"));
		expect(map.get("batch-b")).toEqual(await getAlbumFromD1(env, "batch-b"));
	});
});

/** 在第 failAt 次 run() 时抛错的 D1 包装（模拟批写中途失败） */
function failingD1(inner: D1Like, failAt: number): D1Like {
	let runs = 0;
	return {
		prepare(sql: string) {
			const stmt = inner.prepare(sql);
			const chain = {
				bind(...args: unknown[]) {
					stmt.bind(...args);
					return chain as unknown as ReturnType<D1Like["prepare"]>;
				},
				async run() {
					runs++;
					if (runs === failAt) throw new Error("injected D1 failure");
					return stmt.run();
				},
				first: <T = Record<string, unknown>>() => stmt.first<T>(),
				all: <T = Record<string, unknown>>() => stmt.all<T>(),
			};
			return chain as unknown as ReturnType<D1Like["prepare"]>;
		},
	};
}

describe("相册批写原子性（超过单批 100 条时不得丢数据）", () => {
	const manyPhotos = (n: number, tag: string) =>
		Array.from({ length: n }, (_, i) => ({ url: `https://x/${tag}${i}.jpg` }));

	it("150 张（超单批）写入完整、顺序正确", async () => {
		await upsertAlbumToD1(
			env,
			"big-album",
			{ title: "大相册", source: "local", photos: manyPhotos(150, "v") },
			"",
		);
		const data = await getAlbumFromD1(env, "big-album");
		expect(data!.frontmatter.photos).toHaveLength(150);
		expect(data!.frontmatter.photos![0].url).toBe("https://x/v0.jpg");
		expect(data!.frontmatter.photos![149].url).toBe("https://x/v149.jpg");
	});

	it("再次保存更少照片 → 收敛（旧行被清理，无残留）", async () => {
		await upsertAlbumToD1(
			env,
			"big-album",
			{ title: "大相册", source: "local", photos: manyPhotos(10, "s") },
			"",
		);
		const data = await getAlbumFromD1(env, "big-album");
		expect(data!.frontmatter.photos).toHaveLength(10);
		expect(data!.frontmatter.photos![0].url).toBe("https://x/s0.jpg");
		expect(
			(data!.frontmatter.photos ?? []).some((p) => p.url.includes("/v")),
		).toBe(false);
	});

	it("批写中途失败 → 旧照片不丢；重跑后收敛", async () => {
		// 先建 20 张的小相册（单批完成）
		await upsertAlbumToD1(
			env,
			"fault-album",
			{ title: "故障", source: "local", photos: manyPhotos(20, "old") },
			"",
		);
		expect(
			(await getAlbumFromD1(env, "fault-album"))!.frontmatter.photos,
		).toHaveLength(20);

		// 注入失败：第 1 次 run = 相册行；第 12 次 = 新照片写至第 11 张时抛错
		await expect(
			upsertAlbumToD1(
				{ DB: failingD1(makeD1(db), 12) } as never,
				"fault-album",
				{ title: "故障", source: "local", photos: manyPhotos(150, "new") },
				"",
			),
		).rejects.toThrow();

		const urls = (
			(await getAlbumFromD1(env, "fault-album"))!.frontmatter.photos ?? []
		).map((p) => p.url);
		expect(urls.length).toBeGreaterThanOrEqual(20); // 一条都没丢
		expect(urls.some((u) => u.includes("/old0.jpg"))).toBe(true); // 旧数据仍在

		// 不带故障重跑 → 收敛为 150 张新照片
		await upsertAlbumToD1(
			env,
			"fault-album",
			{ title: "故障", source: "local", photos: manyPhotos(150, "new") },
			"",
		);
		const after = (await getAlbumFromD1(env, "fault-album"))!.frontmatter
			.photos;
		expect(after).toHaveLength(150);
		expect(after!.every((p) => p.url.includes("/new"))).toBe(true);
	});
});
