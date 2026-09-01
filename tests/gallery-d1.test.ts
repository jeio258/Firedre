import { describe, expect, it, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	getAlbumFromD1,
	upsertAlbumToD1,
	deleteAlbumFromD1,
} from "../server/gallery/d1";

interface D1Like {
	prepare(sql: string): D1StmtLike;
}
interface D1StmtLike {
	bind(...args: unknown[]): D1StmtLike;
	run(): Promise<unknown>;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

function makeD1(db: DatabaseSync): D1Like {
	return {
		prepare(sql: string) {
			let args: unknown[] = [];
			const stmt = db.prepare(sql);
			const bind = (...more: unknown[]) => {
				args = [...args, ...more];
				return chain;
			};
			const chain: D1StmtLike = {
				bind,
				run: async () => {
					(stmt as unknown as { run(...a: unknown[]): unknown }).run(...args);
					return {};
				},
				first: async <T>() =>
					((stmt as unknown as { get(...a: unknown[]): unknown }).get(
						...args,
					) as T | undefined) ?? null,
				all: async <T>() => {
					const rows = (stmt as unknown as { all(...a: unknown[]): unknown[] }).all(
						...args,
					) as T[];
					return { results: rows };
				},
			};
			return chain;
		},
	};
}

let db: DatabaseSync;
let env: { DB: D1Like };

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	const migDir = join(process.cwd(), "migrations");
	const files = ["0006_album_webdav.sql", "0007_albums.sql"];
	for (const f of files) {
		db.exec(readFileSync(join(migDir, f), "utf8"));
	}
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
					{ url: "https://x/video.mp4", type: "video", poster: "https://x/p.jpg" },
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
			{ title: "改后", source: "local", photos: [{ url: "https://x/new.jpg" }] },
			"新正文",
		);
		const data = await getAlbumFromD1(env, "test-album");
		expect(data!.frontmatter.title).toBe("改后");
		expect(data!.frontmatter.photos).toHaveLength(1);
		expect(data!.frontmatter.photos![0].url).toBe("https://x/new.jpg");
		expect(data!.content).toBe("新正文");
	});

	it("delete 级联删除照片", async () => {
		await deleteAlbumFromD1(env, "test-album");
		const data = await getAlbumFromD1(env, "test-album");
		expect(data).toBeNull();
	});

	it("不存在的相册返回 null", async () => {
		expect(await getAlbumFromD1(env, "does-not-exist")).toBeNull();
	});
});
