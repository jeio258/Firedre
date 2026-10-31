import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCrudService } from "../server/utils/crud";
import { UserError } from "../server/utils/userError";
import { makeD1 } from "./helpers/d1";

const PROBE_DDL = `
CREATE TABLE IF NOT EXISTS crud_probe (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT 'navbar',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

// id 列存在但不是 rowid 别名（非 PRIMARY KEY）→ 插入后 id 为 NULL，
// 工厂按 last_row_id 回读查不到刚插入的行，用于覆盖 create 的「创建失败」防御分支
const BROKEN_ID_DDL = `
CREATE TABLE IF NOT EXISTS crud_probe_noalias (
  id INTEGER,
  name TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT 'navbar',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

interface ProbeRecord {
	id: number;
	name: string;
	url: string;
	location: string;
	sort_order: number;
	enabled: number;
	updated_at: string;
}

interface ProbeInput {
	name?: string;
	url?: string;
	location?: string;
	sortOrder?: number;
	enabled?: boolean;
}

interface ProbeNormalized {
	name: string;
	url: string;
	location: string;
	sortOrder: number;
	enabled: number;
}

interface ProbeView {
	id: number;
	name: string;
	url: string;
	location: string;
	sortOrder: number;
	enabled: boolean;
}

function normalizeProbe(raw: ProbeInput): ProbeNormalized {
	const name = String(raw.name ?? "").trim();
	if (!name) throw new UserError("探针名称不能为空");
	return {
		name,
		url: String(raw.url ?? "").trim(),
		location: String(raw.location ?? "navbar"),
		sortOrder: Number.isFinite(Number(raw.sortOrder))
			? Math.max(0, Math.round(Number(raw.sortOrder)))
			: 0,
		enabled: raw.enabled === false ? 0 : 1,
	};
}

function toParamsProbe(input: ProbeNormalized): unknown[] {
	return [
		input.name,
		input.url,
		input.location,
		input.sortOrder,
		input.enabled,
	];
}

function toViewProbe(row: ProbeRecord): ProbeView {
	return {
		id: row.id,
		name: row.name,
		url: row.url,
		location: row.location,
		sortOrder: row.sort_order,
		enabled: row.enabled === 1,
	};
}

// orderBy.list 与 orderBy.enabled 刻意取不同排序串：两个真实消费方
// （friends / siteLinks）的两种排序串字符串完全相同，既有测试无法发现
// 「方法用错 orderBy」，此处显式区分以钉住该契约
const ORDER_BY = {
	list: "sort_order DESC, id ASC",
	enabled: "sort_order ASC, id DESC",
};

const BASE_CONFIG = {
	table: "crud_probe",
	columns: ["name", "url", "location", "sort_order", "enabled"],
	normalize: normalizeProbe,
	toParams: toParamsProbe,
	orderBy: ORDER_BY,
	notFoundMessage: "探针不存在",
};

const plain = createCrudService<ProbeRecord, ProbeInput, ProbeNormalized>({
	...BASE_CONFIG,
});

const viewed = createCrudService<
	ProbeRecord,
	ProbeInput,
	ProbeNormalized,
	ProbeView
>({
	...BASE_CONFIG,
	toView: toViewProbe,
});

const filtered = createCrudService<
	ProbeRecord,
	ProbeInput,
	ProbeNormalized,
	ProbeView
>({
	...BASE_CONFIG,
	toView: toViewProbe,
	enabledFilter: (raw) =>
		raw === "navbar" || raw === "footer"
			? { sql: " AND location = ?", bind: [raw] }
			: null,
});

// enabledFilter 会抛错：只要 listEnabled 能正常返回，即证明 raw 为 undefined 时未被调用
const filterNeverCalled = createCrudService<
	ProbeRecord,
	ProbeInput,
	ProbeNormalized,
	ProbeView
>({
	...BASE_CONFIG,
	toView: toViewProbe,
	enabledFilter: () => {
		throw new Error("enabledFilter 不应被调用");
	},
});

const brokenId = createCrudService<ProbeRecord, ProbeInput, ProbeNormalized>({
	...BASE_CONFIG,
	table: "crud_probe_noalias",
});

let db: DatabaseSync;
let env: { DB: ReturnType<typeof makeD1> };

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	db.exec(PROBE_DDL);
	db.exec(BROKEN_ID_DDL);
	// bumpContentVersion 写 site_settings，与生产迁移 0001 的 DDL 对齐
	db.exec(`CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
	env = { DB: makeD1(db) };
});

beforeEach(() => {
	db.exec("DELETE FROM crud_probe; DELETE FROM crud_probe_noalias;");
});

function seed(opts: {
	name: string;
	url?: string;
	location?: string;
	sortOrder?: number;
	enabled?: number;
}): number {
	const info = db
		.prepare(
			"INSERT INTO crud_probe (name, url, location, sort_order, enabled) VALUES (?, ?, ?, ?, ?)",
		)
		.run(
			opts.name,
			opts.url ?? `https://${opts.name}.test`,
			opts.location ?? "navbar",
			opts.sortOrder ?? 0,
			opts.enabled ?? 1,
		);
	return Number(info.lastInsertRowid);
}

describe("createCrudService — list", () => {
	it("全量返回，并按 orderBy.list 排序", async () => {
		seed({ name: "a", sortOrder: 1 });
		seed({ name: "b", sortOrder: 3 });
		seed({ name: "c", sortOrder: 2 });

		const rows = await viewed.list(env as never);
		expect(rows.map((r) => r.name)).toEqual(["b", "c", "a"]);
	});

	it("空表返回空数组", async () => {
		expect(await viewed.list(env as never)).toEqual([]);
	});

	it("配置 toView 时返回视图形状", async () => {
		const id = seed({ name: "a", sortOrder: 2 });
		const rows = await viewed.list(env as never);
		expect(rows).toEqual([
			{
				id,
				name: "a",
				url: "https://a.test",
				location: "navbar",
				sortOrder: 2,
				enabled: true,
			},
		]);
	});

	it("未配置 toView 时原样返回数据行（snake_case、enabled 为数字）", async () => {
		const id = seed({ name: "a", sortOrder: 2, enabled: 0 });
		const rows = await plain.list(env as never);
		expect(rows).toEqual([
			{
				id,
				name: "a",
				url: "https://a.test",
				location: "navbar",
				sort_order: 2,
				enabled: 0,
				updated_at: expect.any(String),
			},
		]);
	});
});

describe("createCrudService — listEnabled", () => {
	it("排除停用项，并按 orderBy.enabled 排序", async () => {
		seed({ name: "a", sortOrder: 1 });
		seed({ name: "b", sortOrder: 3 });
		seed({ name: "c", sortOrder: 2 });
		seed({ name: "d", sortOrder: 0, enabled: 0 });

		const rows = await viewed.listEnabled(env as never);
		expect(rows.map((r) => r.name)).toEqual(["a", "c", "b"]);
	});

	it("raw 为 undefined 时不调用 enabledFilter", async () => {
		seed({ name: "a" });
		// filterNeverCalled 的 enabledFilter 会抛错；能正常返回即证明未被调用
		const rows = await filterNeverCalled.listEnabled(env as never);
		expect(rows.map((r) => r.name)).toEqual(["a"]);
	});

	it("未配置 enabledFilter 时忽略 raw", async () => {
		seed({ name: "a", location: "navbar", sortOrder: 1 });
		seed({ name: "b", location: "footer", sortOrder: 2 });

		const rows = await viewed.listEnabled(env as never, "footer");
		expect(rows.map((r) => r.name)).toEqual(["a", "b"]);
	});

	it("enabledFilter 返回 null 时不追加条件（非法 location 静默放行）", async () => {
		seed({ name: "a", location: "navbar", sortOrder: 1 });
		seed({ name: "b", location: "footer", sortOrder: 2 });
		seed({ name: "c", location: "navbar", sortOrder: 3, enabled: 0 });

		const rows = await filtered.listEnabled(env as never, "not-a-location");
		expect(rows.map((r) => r.name)).toEqual(["a", "b"]);
	});

	it("enabledFilter 返回 SQL 片段时按参过滤", async () => {
		seed({ name: "a", location: "navbar", sortOrder: 1 });
		seed({ name: "b", location: "footer", sortOrder: 2 });
		seed({ name: "c", location: "navbar", sortOrder: 3, enabled: 0 });

		const rows = await filtered.listEnabled(env as never, "navbar");
		expect(rows.map((r) => r.name)).toEqual(["a"]);
	});
});

describe("createCrudService — get", () => {
	it("按 id 返回单行（含 toView）", async () => {
		const id = seed({ name: "a", sortOrder: 5 });
		expect(await viewed.get(env as never, id)).toEqual({
			id,
			name: "a",
			url: "https://a.test",
			location: "navbar",
			sortOrder: 5,
			enabled: true,
		});
	});

	it("id 不存在返回 null", async () => {
		expect(await viewed.get(env as never, 99999)).toBeNull();
	});
});

describe("createCrudService — create", () => {
	it("normalize 生效、列与参数顺序一致，并回读完整行", async () => {
		const created = await viewed.create(env as never, {
			name: "  spaced  ",
			url: "  https://x.test  ",
			location: "footer",
			sortOrder: 2.6,
			enabled: false,
		});

		expect(created.name).toBe("spaced");
		expect(created.url).toBe("https://x.test");
		expect(created.location).toBe("footer");
		expect(created.sortOrder).toBe(3);
		expect(created.enabled).toBe(false);

		// 落库后各列落在对应字段：列顺序与 toParams 顺序不一致时会在此暴露
		const raw = db
			.prepare("SELECT * FROM crud_probe WHERE id = ?")
			.get(created.id) as ProbeRecord;
		expect(raw.location).toBe("footer");
		expect(raw.sort_order).toBe(3);
		expect(raw.enabled).toBe(0);
		expect(raw.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
	});

	it("normalize 抛 UserError 时透传且不写入任何行", async () => {
		await expect(viewed.create(env as never, { name: "   " })).rejects.toThrow(
			UserError,
		);
		const row = db.prepare("SELECT COUNT(*) AS c FROM crud_probe").get() as {
			c: number;
		};
		expect(row.c).toBe(0);
	});

	it("回读不到新建行时抛「创建失败」（防御分支）", async () => {
		await expect(brokenId.create(env as never, { name: "x" })).rejects.toThrow(
			"创建失败",
		);
	});
});

describe("createCrudService — update", () => {
	it("存在时全量替换并刷新 updated_at", async () => {
		const id = seed({ name: "old", sortOrder: 9 });
		db.prepare(
			"UPDATE crud_probe SET updated_at = '2000-01-01 00:00:00' WHERE id = ?",
		).run(id);

		const updated = await viewed.update(env as never, id, {
			name: "new",
			url: "https://new.test",
			location: "footer",
			sortOrder: 4,
			enabled: false,
		});

		expect(updated.name).toBe("new");
		expect(updated.sortOrder).toBe(4);
		expect(updated.enabled).toBe(false);

		const raw = db
			.prepare("SELECT updated_at FROM crud_probe WHERE id = ?")
			.get(id) as { updated_at: string };
		expect(raw.updated_at).not.toBe("2000-01-01 00:00:00");
		expect(raw.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
	});

	it("全量替换语义：未传字段被 normalize 默认值覆盖", async () => {
		const id = seed({
			name: "old",
			sortOrder: 9,
			location: "footer",
			enabled: 0,
		});

		const updated = await viewed.update(env as never, id, {
			name: "only-name",
		});
		expect(updated).toEqual({
			id,
			name: "only-name",
			url: "",
			location: "navbar",
			sortOrder: 0,
			enabled: true,
		});
	});

	it("id 不存在时抛 notFoundMessage 文案且不写入", async () => {
		seed({ name: "keep" });

		await expect(
			viewed.update(env as never, 99999, { name: "x" }),
		).rejects.toThrow("探针不存在");

		const rows = db.prepare("SELECT name FROM crud_probe").all() as Array<{
			name: string;
		}>;
		expect(rows.map((r) => r.name)).toEqual(["keep"]);
	});

	it("exists 检查先于 normalize（不存在 + 非法入参 → notFoundMessage）", async () => {
		await expect(
			viewed.update(env as never, 99999, { name: "" }),
		).rejects.toThrow("探针不存在");
	});

	it("normalize 抛错时透传，且无写入", async () => {
		const id = seed({ name: "keep", sortOrder: 7 });

		await expect(viewed.update(env as never, id, { name: "" })).rejects.toThrow(
			UserError,
		);

		const raw = db
			.prepare("SELECT name, sort_order FROM crud_probe WHERE id = ?")
			.get(id) as { name: string; sort_order: number };
		expect(raw.name).toBe("keep");
		expect(raw.sort_order).toBe(7);
	});
});

describe("createCrudService — remove", () => {
	it("id 存在时删除并返回 true", async () => {
		const id = seed({ name: "gone" });

		expect(await viewed.remove(env as never, id)).toBe(true);
		expect(await viewed.get(env as never, id)).toBeNull();
	});

	it("id 不存在时返回 false 且不抛错", async () => {
		expect(await viewed.remove(env as never, 99999)).toBe(false);
	});
});
