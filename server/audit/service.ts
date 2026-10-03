// 后台操作审计：写操作留痕（3.2）。审计失败静默，不拖累业务主流程。
import type { CloudflareEnv } from "../../types/env";

export interface AuditEntry {
	actor: string;
	action: string;
	targetType?: string;
	targetId?: string;
	detail?: string;
}

export async function logAudit(
	env: CloudflareEnv,
	entry: AuditEntry,
): Promise<void> {
	try {
		await env.DB.prepare(
			`INSERT INTO audit_logs (actor, action, target_type, target_id, detail)
			 VALUES (?, ?, ?, ?, ?)`,
		)
			.bind(
				entry.actor,
				entry.action,
				entry.targetType ?? "",
				entry.targetId ?? "",
				entry.detail ?? "",
			)
			.run();
	} catch {
		// 审计失败（如表缺失/库异常）不影响业务写
	}
}

export interface AuditRow {
	id: number;
	actor: string;
	action: string;
	target_type: string;
	target_id: string;
	detail: string;
	created_at: string;
}

export async function listAudit(
	env: CloudflareEnv,
	limit = 50,
): Promise<AuditRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, actor, action, target_type, target_id, detail, created_at
		 FROM audit_logs ORDER BY id DESC LIMIT ?`,
	)
		.bind(Math.min(200, Math.max(1, limit)))
		.all<AuditRow>();
	return results ?? [];
}
