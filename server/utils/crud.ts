import type { CloudflareEnv } from "../../types/env";
import { UserError } from "./userError";

/**
 * 通用 CRUD 数据层工厂。
 *
 * friends / siteLinks 等"单一实体、D1 存储"的服务过去各自手写
 * get/create/update/delete 样板（SELECT by id + first、INSERT + last_row_id 回查、
 * 存在性检查 + UPDATE + 回查、DELETE + changes>0），仅表名/字段/排序/映射不同。
 * 本工厂把这套骨架收敛为一处，业务差异（校验、列映射、排序、视图映射、过滤）由配置注入。
 *
 * 约定：
 * - 表必须有 id 主键与 updated_at（写入时由 SQL 的 datetime('now') 维护）。
 * - 列顺序即 insert/update 的绑定参数顺序（不含 id / updated_at）。
 */

export interface CrudConfig<TRecord, TInput, TNormalized = Record<string, unknown>, TView = TRecord> {
	table: string;
	/** 列名列表（不含 id / updated_at），顺序即绑定参数顺序 */
	columns: string[];
	/** 校验并规范化输入；非法抛 UserError，返回的键序须与 columns 一致 */
	normalize: (raw: TInput) => TNormalized;
	/** 按 columns 顺序返回绑定参数 */
	toParams: (input: TNormalized) => unknown[];
	/** 行 → 视图映射（不提供则恒等返回 record） */
	toView?: (row: TRecord) => TView;
	/** 列表排序子句：list=全量，enabled=启用列表 */
	orderBy: { list: string; enabled: string };
	/** 启用过滤的附加子句（用于 listEnabled 的可选过滤，如 siteLinks 按 location） */
	enabledFilter?: (raw: unknown) => { sql: string; bind: unknown[] } | null;
	/** 实体不存在时的错误文案 */
	notFoundMessage: string;
}

export function createCrudService<TRecord, TInput, TNormalized = Record<string, unknown>, TView = TRecord>(
	cfg: CrudConfig<TRecord, TInput, TNormalized, TView>,
) {
	const cols = cfg.columns.join(", ");
	const placeholders = cfg.columns.map(() => "?").join(", ");
	const setters = cfg.columns.map((c) => `${c} = ?`).join(", ");
	const bindAll = (input: TNormalized) =>
		cfg.toParams(input);

	const toView = (row: TRecord): TView =>
		(cfg.toView ? cfg.toView(row) : (row as unknown as TView));

	/** 全量列表（后台管理） */
	async function list(env: CloudflareEnv): Promise<TView[]> {
		const { results } = await env.DB.prepare(
			`SELECT * FROM ${cfg.table} ORDER BY ${cfg.orderBy.list}`,
		).all<TRecord>();
		return (results || []).map(toView);
	}

	/** 启用列表（前台展示），可选附加过滤 */
	async function listEnabled(env: CloudflareEnv, raw?: unknown): Promise<TView[]> {
		let sql = `SELECT * FROM ${cfg.table} WHERE enabled = 1`;
		const bind: unknown[] = [];
		if (cfg.enabledFilter && raw !== undefined) {
			const extra = cfg.enabledFilter(raw);
			if (extra) {
				sql += extra.sql;
				bind.push(...extra.bind);
			}
		}
		const stmt = env.DB.prepare(`${sql} ORDER BY ${cfg.orderBy.enabled}`);
		const { results } = bind.length
			? await stmt.bind(...bind).all<TRecord>()
			: await stmt.all<TRecord>();
		return (results || []).map(toView);
	}

	async function get(env: CloudflareEnv, id: number): Promise<TView | null> {
		const row = await env.DB.prepare(
			`SELECT * FROM ${cfg.table} WHERE id = ?`,
		).bind(id).first<TRecord>();
		return row ? toView(row) : null;
	}

	async function create(env: CloudflareEnv, raw: TInput): Promise<TView> {
		const input = cfg.normalize(raw);
		const result = await env.DB.prepare(
			`INSERT INTO ${cfg.table} (${cols}, updated_at) VALUES (${placeholders}, datetime('now'))`,
		).bind(...bindAll(input)).run();
		const id = Number(result.meta.last_row_id);
		const created = await get(env, id);
		if (!created) throw new UserError("创建失败");
		return created;
	}

	async function update(env: CloudflareEnv, id: number, raw: TInput): Promise<TView> {
		const exists = await get(env, id);
		if (!exists) throw new UserError(cfg.notFoundMessage);
		const input = cfg.normalize(raw);
		await env.DB.prepare(
			`UPDATE ${cfg.table} SET ${setters}, updated_at = datetime('now') WHERE id = ?`,
		).bind(...bindAll(input), id).run();
		const updated = await get(env, id);
		if (!updated) throw new UserError(cfg.notFoundMessage);
		return updated;
	}

	async function remove(env: CloudflareEnv, id: number): Promise<boolean> {
		const result = await env.DB.prepare(
			`DELETE FROM ${cfg.table} WHERE id = ?`,
		).bind(id).run();
		return (result.meta.changes ?? 0) > 0;
	}

	return { list, listEnabled, get, create, update, remove };
}
