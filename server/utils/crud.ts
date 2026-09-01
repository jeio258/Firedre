import type { CloudflareEnv } from "../../types/env";
import { UserError } from "./userError";

export interface CrudConfig<TRecord, TInput, TNormalized = Record<string, unknown>, TView = TRecord> {
	table: string;

	columns: string[];

	normalize: (raw: TInput) => TNormalized;

	toParams: (input: TNormalized) => unknown[];

	toView?: (row: TRecord) => TView;

	orderBy: { list: string; enabled: string };

	enabledFilter?: (raw: unknown) => { sql: string; bind: unknown[] } | null;

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

	async function list(env: CloudflareEnv): Promise<TView[]> {
		const { results } = await env.DB.prepare(
			`SELECT * FROM ${cfg.table} ORDER BY ${cfg.orderBy.list}`,
		).all<TRecord>();
		return (results || []).map(toView);
	}

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
