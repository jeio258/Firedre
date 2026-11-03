import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
	actor: null as unknown,
	// 稳定容器：cfEnv 引用同一对象，beforeEach 只换属性，路由模块拿到的始终是当前 env
	env: {} as { DB?: unknown; BUCKET?: unknown },
}));

vi.mock("@server/auth/perms", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@server/auth/perms")>();
	return {
		...actual,
		resolveBackendActor: async () => h.actor,
	};
});

vi.mock("@server/utils/rateLimiter", () => ({
	withRateLimit: async (
		_e: unknown,
		_r: unknown,
		_o: unknown,
		fn: () => Promise<Response>,
	) => fn(),
}));

vi.mock("../src/lib/api", () => ({
	cfEnv: h.env,
	json: (data: unknown, status = 200) =>
		new Response(JSON.stringify(data), { status }),
	badRequest: (message = "Bad Request") =>
		new Response(JSON.stringify({ error: message }), { status: 400 }),
	notFound: (message = "Not found") =>
		new Response(JSON.stringify({ error: message }), { status: 404 }),
	unauthorized: () =>
		new Response(JSON.stringify({ message: "未授权" }), { status: 401 }),
	methodNotAllowed: () => new Response(null, { status: 405 }),
	serverError: () => new Response(null, { status: 500 }),
	fromServiceError: (e: unknown) =>
		new Response(JSON.stringify({ error: String(e) }), { status: 500 }),
}));

import {
	deletePost,
	getPostOwner,
	listPosts,
	upsertPost,
} from "../server/posts/service";
import { makeD1 } from "./helpers/d1";
import { applyMigrations, migrationFiles } from "./helpers/migrations";
import { makeR2 } from "./helpers/r2";

const source = (title: string, published = true) =>
	`---\ntitle: ${title}\ndate: 2026-01-01\n${published ? "" : "draft: true\n"}---\n\n正文 ${title}\n`;

function actorFor(
	kind: "admin" | "author1" | "author2" | "anon",
	buildAbility: typeof import("@server/auth/perms").buildAbility,
) {
	if (kind === "anon") return null;
	if (kind === "admin")
		return {
			isAdmin: true,
			user: { id: "u-admin", role: "admin" },
			perms: [],
			ability: buildAbility("admin", []),
		};
	const id = kind === "author1" ? "u1" : "u2";
	return {
		isAdmin: false,
		user: { id, role: "user" },
		perms: ["post:create"],
		ability: buildAbility("user", ["post:create"]),
	};
}

async function callApi(
	method: "GET" | "PUT" | "DELETE",
	path: string,
	body?: string,
) {
	const mod = await import("../src/pages/api/posts/[...path].ts");
	const handler = mod[method];
	const [pathname, query = ""] = path.split("?");
	return handler({
		params: { path: pathname || undefined },
		request: new Request(
			`https://x/api/posts/${pathname}${query ? `?${query}` : ""}`,
			{
				method,
				...(body !== undefined ? { body } : {}),
			},
		),
	} as never);
}

describe("posts author_id：归属迁移 / 过滤 / 越权隔离", () => {
	let db: DatabaseSync;

	beforeAll(async () => {
		db = new DatabaseSync(":memory:");
	});

	beforeEach(() => {
		db = new DatabaseSync(":memory:");
		applyMigrations(db);
		db.exec(
			"INSERT INTO users (id, email, name, role) VALUES ('u-admin','a@a','A','admin'), ('u1','u1@a','U1','user'), ('u2','u2@a','U2','user')",
		);
		h.env.DB = makeD1(db);
		h.env.BUCKET = makeR2();
	});

	it("迁移 0002 回填：既有文章归属首个 admin 用户", async () => {
		// 复现升级路径：先只跑 0001 并灌入历史数据，再单独应用 0002
		const legacy = new DatabaseSync(":memory:");
		applyMigrations(legacy, ["0001_init.sql"]);
		legacy.exec(
			"INSERT INTO users (id, email, name, role) VALUES ('u-admin','a@a','A','admin'), ('u1','u1@a','U1','user')",
		);
		legacy.exec(
			"INSERT INTO posts (slug,title,date,r2_key) VALUES ('old','Old','2026-01-01','r2/old')",
		);
		applyMigrations(
			legacy,
			migrationFiles().filter((f) => f !== "0001_init.sql"),
		);
		const row = legacy
			.prepare("SELECT author_id FROM posts WHERE slug = 'old'")
			.get() as { author_id: string | null };
		expect(row.author_id).toBe("u-admin");
	});

	it("listPosts：authorId 过滤只返回本人文章（含草稿），无过滤时公开语义不变", async () => {
		const env = { DB: makeD1(db), BUCKET: makeR2() };
		await upsertPost(env as never, "p1", source("P1"), "u1");
		await upsertPost(env as never, "p2", source("P2"), "u1");
		await upsertPost(env as never, "draft1", source("D1", false), "u1");
		await upsertPost(env as never, "admin1", source("A1"), "u-admin");

		const mine = await listPosts(env as never, {
			includeUnpublished: true,
			authorId: "u1",
		});
		expect(mine.posts.map((p) => p.slug).sort()).toEqual([
			"draft1",
			"p1",
			"p2",
		]);

		const publicView = await listPosts(env as never, {});
		expect(publicView.posts.map((p) => p.slug).sort()).toEqual([
			"admin1",
			"p1",
			"p2",
		]);

		const all = await listPosts(env as never, { includeUnpublished: true });
		expect(all.posts.map((p) => p.slug).sort()).toEqual([
			"admin1",
			"draft1",
			"p1",
			"p2",
		]);
	});

	it("upsertPost：创建写入归属，更新不改变归属", async () => {
		const env = { DB: makeD1(db), BUCKET: makeR2() };
		await upsertPost(env as never, "p1", source("V1"), "u1");
		await upsertPost(env as never, "p1", source("V2"));
		const owner = await getPostOwner(env as never, "p1");
		expect(owner?.author_id).toBe("u1");
		expect(owner?.published).toBe(1);
	});

	it("后台列表 mine=1：作者只见自己的（含草稿），站长看全部", async () => {
		const env = h.env as never;
		await upsertPost(env, "p1", source("P1"), "u1");
		await upsertPost(env, "draft1", source("D1", false), "u1");
		await upsertPost(env, "admin1", source("A1"), "u-admin");

		const { buildAbility } = await import("@server/auth/perms");
		h.actor = actorFor("author1", buildAbility);
		const res1 = await callApi("GET", "?pageSize=200&mine=1");
		expect(res1.status).toBe(200);
		const data1 = (await res1.json()) as {
			posts: { slug: string; password?: string }[];
		};
		expect(data1.posts.map((p) => p.slug).sort()).toEqual(["draft1", "p1"]);

		h.actor = actorFor("admin", buildAbility);
		const resAdmin = await callApi("GET", "?pageSize=200&mine=1");
		const dataAdmin = (await resAdmin.json()) as {
			posts: { slug: string }[];
		};
		expect(dataAdmin.posts.map((p) => p.slug).sort()).toEqual([
			"admin1",
			"draft1",
			"p1",
		]);

		// 无 mine=1：作者走公开列表语义，看不到草稿
		h.actor = actorFor("author1", buildAbility);
		const resPub = await callApi("GET", "?pageSize=200");
		const dataPub = (await resPub.json()) as { posts: { slug: string }[] };
		expect(dataPub.posts.map((p) => p.slug).sort()).toEqual(["admin1", "p1"]);
	});

	it("单篇：本人草稿可读（含源文），他人草稿 404，他人已发布走公开脱敏", async () => {
		const env = h.env as never;
		await upsertPost(env, "draft1", source("D1", false), "u1");
		await upsertPost(env, "pub1", source("P1"), "u1");

		const { buildAbility } = await import("@server/auth/perms");
		h.actor = actorFor("author1", buildAbility);
		const own = await callApi("GET", "draft1");
		expect(own.status).toBe(200);
		const ownData = (await own.json()) as { markdown?: string };
		expect(ownData.markdown).toContain("D1");

		h.actor = actorFor("author2", buildAbility);
		const otherDraft = await callApi("GET", "draft1");
		expect(otherDraft.status).toBe(404);

		const otherPub = await callApi("GET", "pub1");
		expect(otherPub.status).toBe(200);
	});

	it("PUT：非本人更新 403，本人可改，站长可改一切，新建写入归属", async () => {
		const env = h.env as never;
		await upsertPost(env, "p1", source("P1"), "u1");
		await upsertPost(env, "admin1", source("A1"), "u-admin");

		const { buildAbility } = await import("@server/auth/perms");
		h.actor = actorFor("author2", buildAbility);
		expect((await callApi("PUT", "p1", source("X"))).status).toBe(403);
		h.actor = actorFor("author1", buildAbility);
		expect((await callApi("PUT", "p1", source("P1-v2"))).status).toBe(200);
		h.actor = actorFor("admin", buildAbility);
		expect((await callApi("PUT", "admin1", source("A1-v2"))).status).toBe(200);

		h.actor = actorFor("author2", buildAbility);
		expect((await callApi("PUT", "new-post", source("N"))).status).toBe(200);
		const owner = await getPostOwner(env, "new-post");
		expect(owner?.author_id).toBe("u2");

		// 匿名（无后台身份）→ 401
		h.actor = actorFor("anon", buildAbility);
		expect((await callApi("PUT", "anon-post", source("Y"))).status).toBe(401);
	});

	it("DELETE：非本人 403，本人与站长可删", async () => {
		const env = h.env as never;
		await upsertPost(env, "p1", source("P1"), "u1");
		await upsertPost(env, "admin1", source("A1"), "u-admin");

		const { buildAbility } = await import("@server/auth/perms");
		h.actor = actorFor("author2", buildAbility);
		expect((await callApi("DELETE", "p1")).status).toBe(403);
		h.actor = actorFor("author1", buildAbility);
		expect((await callApi("DELETE", "p1")).status).toBe(200);
		h.actor = actorFor("admin", buildAbility);
		expect((await callApi("DELETE", "admin1")).status).toBe(200);
		await expect(deletePost(env, "p1")).resolves.toBe(false);
	});
});
