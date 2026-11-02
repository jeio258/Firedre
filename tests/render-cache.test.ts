import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { detectMarkdownFeatures } from "../server/posts/render";
import { renderMarkdownCached } from "../server/posts/renderCache";
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

describe("detectMarkdownFeatures 特性探测", () => {
	it("math：行内/块级/多美元均命中，普通文本不命中", () => {
		expect(detectMarkdownFeatures("$x+y$").math).toBe(true);
		expect(detectMarkdownFeatures("$$\\int_a^b f$$").math).toBe(true);
		expect(detectMarkdownFeatures("nothing here").math).toBe(false);
	});

	it("callouts：::: 与 [!NOTE] 命中，普通引用不命中", () => {
		expect(detectMarkdownFeatures(":::note\nhi\n:::").callouts).toBe(true);
		expect(detectMarkdownFeatures("> [!TIP]\n> go").callouts).toBe(true);
		expect(detectMarkdownFeatures("> plain quote").callouts).toBe(false);
	});

	it("codeGroup/diagrams：仅对应 fenced 语言命中", () => {
		expect(detectMarkdownFeatures("```group\ntab\n```").codeGroup).toBe(true);
		expect(detectMarkdownFeatures("```ts\nconst a = 1;\n```").codeGroup).toBe(
			false,
		);
		expect(detectMarkdownFeatures("```mermaid\ngraph TD\n```").diagrams).toBe(
			true,
		);
		expect(detectMarkdownFeatures("```plantuml\n@startuml\n```").diagrams).toBe(
			true,
		);
		expect(detectMarkdownFeatures("```js\nconsole.log(1)\n```").diagrams).toBe(
			false,
		);
	});

	it("github：::github{} 命中", () => {
		expect(detectMarkdownFeatures('::github{repo="owner/repo"}').github).toBe(
			true,
		);
		expect(detectMarkdownFeatures("github.com/owner/repo").github).toBe(false);
	});
});

describe("renderMarkdownCached L1/L2", () => {
	const origin = "https://render-cache-test.invalid";
	const l2Key = (scope: string, version: string) =>
		`${origin}/__md_render_cache__/${scope}/${version}`;

	it("L1 命中不再渲染：删 L2 后二次调用仍返回同一对象且不回写", async () => {
		const v1 = await renderMarkdownCached("t-l1", "v1", "# Hello", origin);
		// 首次调用渲染 → 写 L2
		expect(store.has(l2Key("t-l1", "v1"))).toBe(true);

		store.delete(l2Key("t-l1", "v1"));
		const v2 = await renderMarkdownCached("t-l1", "v1", "# Hello", origin);
		// 命中 L1：返回同一对象引用（未重渲染），也无 L2 回写
		expect(v2).toBe(v1);
		expect(store.has(l2Key("t-l1", "v1"))).toBe(false);
	});

	it("LRU 淘汰：超出 64 条后最旧条目被挤出并重新渲染", async () => {
		// 先放一个锚点条目，再灌满/超出容量
		await renderMarkdownCached("t-lru", "anchor", "# anchor", origin);
		store.delete(l2Key("t-lru", "anchor"));
		for (let i = 0; i < 70; i++) {
			await renderMarkdownCached("t-lru", `v${i}`, `# item ${i}`, origin);
			store.delete(l2Key("t-lru", `v${i}`));
		}
		// 最新条目仍应 L1 命中：L2 已删但调用成功且不回写
		const last = await renderMarkdownCached(
			"t-lru",
			"v69",
			"# item 69",
			origin,
		);
		expect(last.html).toContain("item 69");
		expect(store.has(l2Key("t-lru", "v69"))).toBe(false);
		// 锚点已被 LRU 挤出：重新渲染并回写 L2
		const anchorAgain = await renderMarkdownCached(
			"t-lru",
			"anchor",
			"# anchor",
			origin,
		);
		expect(anchorAgain.html).toContain("anchor");
		expect(store.has(l2Key("t-lru", "anchor"))).toBe(true);
	});

	it("无 origin 时只用 L1：不触碰 caches", async () => {
		const v = await renderMarkdownCached("t-noorigin", "v1", "# x");
		expect(store.has("t-noorigin@v1")).toBe(false);
		expect(v.html).toContain("x");
	});
});
