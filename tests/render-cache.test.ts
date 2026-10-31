import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPostBySlug, upsertPost } from "../server/posts/service";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";
import { makeR2 } from "./helpers/r2";

// mock 全局 caches（node 无 caches），验证渲染缓存逻辑。
// ⚠ 与 workerd 同语义：**相对字符串键会抛 TypeError: Invalid URL**（生产 Cache API 即如此）。
// 这里显式校验，避免再用"宽松字符串 Map"掩盖真实缺陷（曾因此漏掉"缓存恒 miss"的真 bug）。
function assertAbsoluteKey(key: unknown): string {
	const s =
		typeof key === "string"
			? key
			: ((key as { url?: string } | null)?.url ?? "");
	try {
		new URL(s);
	} catch {
		throw new TypeError(`Invalid URL: ${s}`);
	}
	return s;
}

const store = new Map<string, { body: string; at: number }>();
(globalThis as unknown as { caches: unknown }).caches = {
	default: {
		match: async (key: unknown) => {
			const k = assertAbsoluteKey(key);
			const item = store.get(k);
			if (!item) return undefined;
			if (Date.now() - item.at > 60_000) {
				store.delete(k);
				return undefined;
			}
			return new Response(item.body, {
				headers: { "Content-Type": "application/json" },
			});
		},
		put: async (key: unknown, resp: Response) => {
			store.set(assertAbsoluteKey(key), {
				body: await resp.text(),
				at: Date.now(),
			});
		},
	},
};

let db: DatabaseSync;
let env: { DB: unknown; BUCKET: ReturnType<typeof makeR2> };

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
});

beforeEach(() => {
	db.exec(
		"DELETE FROM posts; DELETE FROM posts_fts; DELETE FROM post_taxonomy;",
	);
	store.clear();
	env = { DB: makeD1(db), BUCKET: makeR2() };
});

const source = (title: string) =>
	`---\ntitle: ${title}\ndate: 2026-01-01\npublished: true\n---\n\n# ${title}\n\n正文 ${title}`;

describe("文章渲染缓存", () => {
	it("渲染结果写入缓存键（含 r2_key 与 settingsVersion）", async () => {
		await upsertPost(env as never, "cache-a", source("CacheA"));
		const detail = await getPostBySlug(env as never, "cache-a", {});
		expect(detail?.html).toContain("CacheA");
		// 应至少写入一条渲染缓存
		expect(store.size).toBeGreaterThan(0);
		const [key] = store.keys();
		// 键必须是合法**绝对 URL**（相对键在 workerd 会抛 TypeError → 缓存恒 miss）
		expect(() => new URL(key)).not.toThrow();
		expect(key.startsWith("https://")).toBe(true);
		expect(key).toContain("/__post_render__/posts/cache-a/");
		expect(key).toContain("?v=");
	});

	it("缓存命中跳过重渲染（内容未变时 key 相同）", async () => {
		await upsertPost(env as never, "cache-b", source("CacheB"));
		const d1 = await getPostBySlug(env as never, "cache-b", {});
		const sizeAfter1 = store.size;
		// 再次读取：内容/版本未变 → 命中缓存，不新增写入
		const d2 = await getPostBySlug(env as never, "cache-b", {});
		expect(d2?.html).toBe(d1?.html);
		expect(store.size).toBe(sizeAfter1);
	});

	it("内容变化（r2_key 变）后重新渲染", async () => {
		await upsertPost(env as never, "cache-c", source("V1"));
		await getPostBySlug(env as never, "cache-c", {});
		const keys1 = new Set(store.keys());
		await upsertPost(env as never, "cache-c", source("V2 Changed"));
		await getPostBySlug(env as never, "cache-c", {});
		const keys2 = new Set(store.keys());
		// 内容 hash 变 → 新 key；旧 key 的缓存条目仍在但不再命中
		expect(
			[...keys2].some((k) => k.includes("V2") || k !== [...keys1][0]),
		).toBe(true);
	});
});

describe("getPostBySlug 缓存优先（免空读 R2）", () => {
	function spyBucketGets() {
		let gets = 0;
		const orig = env.BUCKET.get.bind(env.BUCKET);
		env.BUCKET.get = async (key: string) => {
			gets++;
			return orig(key);
		};
		return () => gets;
	}

	it("缓存命中后不再读取 R2", async () => {
		await upsertPost(env as never, "cache-r2", source("R2Once"));
		const getGets = spyBucketGets();
		const d1 = await getPostBySlug(env as never, "cache-r2", {});
		const afterFirst = getGets();
		expect(afterFirst).toBeGreaterThan(0); // 首访未命中 → 读 R2
		const d2 = await getPostBySlug(env as never, "cache-r2", {});
		expect(getGets()).toBe(afterFirst); // 命中 → 不再读 R2
		expect(d2?.html).toBe(d1?.html);
	});

	it("命中与直渲的 frontmatter 一致（含渲染期 words/minutes/excerpt）", async () => {
		await upsertPost(env as never, "cache-fm", source("FM"));
		const miss = await getPostBySlug(env as never, "cache-fm", {});
		const hit = await getPostBySlug(env as never, "cache-fm", {});
		expect(hit?.frontmatter).toEqual(miss?.frontmatter);
		expect(miss?.frontmatter.title).toBe("FM");
		expect(typeof miss?.frontmatter.words).toBe("number");
	});

	it("includeSource 仍读 R2 并返回 source/markdown（渲染结果复用缓存）", async () => {
		await upsertPost(env as never, "cache-src", source("SRC"));
		await getPostBySlug(env as never, "cache-src", {}); // 先填充缓存
		const getGets = spyBucketGets();
		const d = await getPostBySlug(env as never, "cache-src", {
			includeSource: true,
		});
		expect(getGets()).toBe(1);
		expect(d?.source).toContain("title: SRC");
		expect(d?.markdown).toContain("正文 SRC");
		expect(d?.html).toContain("SRC");
	});
});
