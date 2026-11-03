/**
 * 权限体系（角色 + 权限点 + 申请审批）
 *
 * 设计取舍（对齐用户要求「管理员也是用户」）：
 * - 身份只有一个来源：users 表；role='admin' 即管理员（拥有全部权限）。
 * - 细粒度权限用 user_permissions(user_id, perm) 表达，由管理员审批后授予。
 * - 能力判定交给开源库 @casl/ability（can('create','Post')），
 *   存储与审批流程留在 D1（CASL 本身不负责持久化）。
 *
 * 表：
 * - user_permissions(user_id, perm, granted_by, granted_at)
 * - permission_requests(id, user_id, perm, status, note, requested_at, reviewed_by, reviewed_at)
 */
import {
	AbilityBuilder,
	createMongoAbility,
	type MongoAbility,
} from "@casl/ability";
import type { CloudflareEnv } from "../../types/env";
import { getAuthenticatedAdminUsername } from "./adminSession";
import { type AuthUser, getAuthIdentity } from "./userSession";

// ---------- 权限点目录 ----------

export interface PermSpec {
	id: string;
	label: string;
	desc: string;
	/** 该权限点授予的 CASL 动作/主体（用于能力判定） */
	grants: Array<[AppAction, AppSubject]>;
}

export type AppAction = "manage" | "create" | "read" | "update" | "delete";
export type AppSubject = "all" | "Backend" | "Post";
export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

/** 权限点目录：新增后台细粒度权限只需在此登记 */
export const PERM_CATALOG: PermSpec[] = [
	{
		id: "post:create",
		label: "发布文章",
		desc: "可进入后台的「文章管理」，创建 / 编辑 / 删除文章",
		grants: [
			["read", "Backend"],
			["create", "Post"],
			["read", "Post"],
			["update", "Post"],
			["delete", "Post"],
		],
	},
];

export const PERM_IDS = PERM_CATALOG.map((p) => p.id);

export function isKnownPerm(perm: string): boolean {
	return PERM_IDS.includes(perm);
}

/** 权限点 → 能力：role=admin 拥有全部；否则按已授予权限点累加 */
export function buildAbility(
	role: string,
	perms: readonly string[],
): AppAbility {
	const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
	if (role === "admin") {
		can("manage", "all");
		return build();
	}
	for (const spec of PERM_CATALOG) {
		if (!perms.includes(spec.id)) continue;
		for (const [action, subject] of spec.grants) can(action, subject);
	}
	return build();
}

// ---------- 存取 ----------

export interface PermRequestRow {
	id: string;
	user_id: string;
	perm: string;
	status: string;
	note: string;
	requested_at: string;
	reviewed_by: string | null;
	reviewed_at: string | null;
}

const REQUEST_PAGE_SIZE = 20;

export async function listUserPerms(
	db: CloudflareEnv["DB"],
	userId: string,
): Promise<string[]> {
	try {
		const res = await db
			.prepare("SELECT perm FROM user_permissions WHERE user_id = ?")
			.bind(userId)
			.all<{ perm: string }>();
		return (res.results ?? []).map((r) => r.perm).filter(isKnownPerm);
	} catch (e) {
		console.error("[perms] 读取用户权限失败:", e);
		return [];
	}
}

export async function listMyRequests(
	db: CloudflareEnv["DB"],
	userId: string,
): Promise<PermRequestRow[]> {
	try {
		const res = await db
			.prepare(
				"SELECT id, user_id, perm, status, note, requested_at, reviewed_by, reviewed_at FROM permission_requests WHERE user_id = ? ORDER BY requested_at DESC LIMIT 20",
			)
			.bind(userId)
			.all<PermRequestRow>();
		return res.results ?? [];
	} catch (e) {
		console.error("[perms] 读取申请失败:", e);
		return [];
	}
}

export type RequestOutcome =
	| { ok: true; request: PermRequestRow }
	| { ok: false; message: string };

/** 提交权限申请：同权限点已有 pending 时不重复建单 */
export async function requestPerm(
	db: CloudflareEnv["DB"],
	userId: string,
	perm: string,
	note = "",
): Promise<RequestOutcome> {
	if (!isKnownPerm(perm)) return { ok: false, message: "未知权限点" };
	const trimmedNote = note.length > 200 ? note.slice(0, 200) : note;

	const granted = await db
		.prepare("SELECT perm FROM user_permissions WHERE user_id = ? AND perm = ?")
		.bind(userId, perm)
		.first<{ perm: string }>();
	if (granted) return { ok: false, message: "你已拥有该权限" };

	const pending = await db
		.prepare(
			"SELECT id FROM permission_requests WHERE user_id = ? AND perm = ? AND status = 'pending'",
		)
		.bind(userId, perm)
		.first<{ id: string }>();
	if (pending) return { ok: false, message: "申请已提交，请等待管理员审批" };

	const id = crypto.randomUUID();
	await db
		.prepare(
			"INSERT INTO permission_requests (id, user_id, perm, status, note) VALUES (?, ?, ?, 'pending', ?)",
		)
		.bind(id, userId, perm, trimmedNote)
		.run();

	return {
		ok: true,
		request: {
			id,
			user_id: userId,
			perm,
			status: "pending",
			note: trimmedNote,
			requested_at: new Date().toISOString().slice(0, 19).replace("T", " "),
			reviewed_by: null,
			reviewed_at: null,
		},
	};
}

export interface AdminRequestView extends PermRequestRow {
	userName: string;
	userEmail: string;
	permLabel: string;
	/** 该权限点当前是否仍在 user_permissions 中（撤销后为 false，与 status 无关） */
	granted: boolean;
}

export async function listRequestsForAdmin(
	db: CloudflareEnv["DB"],
	options: { status?: string; page?: number; pageSize?: number } = {},
): Promise<{
	items: AdminRequestView[];
	total: number;
	page: number;
	pageSize: number;
}> {
	const status =
		options.status && options.status !== "all" ? options.status : "";
	const page = Math.max(1, Math.floor(options.page ?? 1));
	const pageSize = Math.min(
		100,
		Math.max(1, Math.floor(options.pageSize ?? REQUEST_PAGE_SIZE)),
	);
	const where = status ? "WHERE r.status = ?" : "";
	const bindCount: unknown[] = status ? [status] : [];

	const totalRow = await db
		.prepare(`SELECT COUNT(*) AS c FROM permission_requests r ${where}`)
		.bind(...bindCount)
		.first<{ c: number }>();
	const total = totalRow?.c ?? 0;

	const res = await db
		.prepare(
			`SELECT r.id, r.user_id, r.perm, r.status, r.note, r.requested_at, r.reviewed_by, r.reviewed_at,
              COALESCE(u.name, '') AS user_name, COALESCE(u.email, '') AS user_email,
              CASE WHEN p.perm IS NULL THEN 0 ELSE 1 END AS granted
         FROM permission_requests r
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN user_permissions p ON p.user_id = r.user_id AND p.perm = r.perm
         ${where}
         ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.requested_at DESC
         LIMIT ? OFFSET ?`,
		)
		.bind(...bindCount, pageSize, (page - 1) * pageSize)
		.all<
			PermRequestRow & {
				user_name: string;
				user_email: string;
				granted: number;
			}
		>();

	const items: AdminRequestView[] = (res.results ?? []).map((r) => ({
		...r,
		userName: r.user_name,
		userEmail: r.user_email,
		permLabel: PERM_CATALOG.find((p) => p.id === r.perm)?.label ?? r.perm,
		granted: Number(r.granted) === 1,
	}));

	return { items, total, page, pageSize };
}

export type ReviewAction = "approve" | "deny";

/** 审批：approve 时写入 user_permissions（幂等） */
export async function reviewPermRequest(
	db: CloudflareEnv["DB"],
	id: string,
	action: ReviewAction,
	reviewer: string,
): Promise<{ ok: boolean; message?: string; perm?: string }> {
	const row = await db
		.prepare(
			"SELECT id, user_id, perm, status FROM permission_requests WHERE id = ?",
		)
		.bind(id)
		.first<PermRequestRow>();
	if (!row) return { ok: false, message: "申请不存在" };
	if (row.status !== "pending") return { ok: false, message: "该申请已处理" };

	const status = action === "approve" ? "approved" : "denied";
	await db
		.prepare(
			"UPDATE permission_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?",
		)
		.bind(status, reviewer, id)
		.run();

	if (action === "approve") {
		await db
			.prepare(
				"INSERT INTO user_permissions (user_id, perm, granted_by) VALUES (?, ?, ?) ON CONFLICT(user_id, perm) DO UPDATE SET granted_by = excluded.granted_by, granted_at = datetime('now')",
			)
			.bind(row.user_id, row.perm, reviewer)
			.run();
	}

	return { ok: true, perm: row.perm };
}

export async function revokePerm(
	db: CloudflareEnv["DB"],
	userId: string,
	perm: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM user_permissions WHERE user_id = ? AND perm = ?")
		.bind(userId, perm)
		.run();
}

// ---------- 后台访问判定 ----------

export interface BackendActor {
	/** 传统 admin_users 会话（保留为后路，不破坏既有后台登录） */
	viaAdminSession: boolean;
	/** users 体系会话（管理员也是用户） */
	user: AuthUser | null;
	isAdmin: boolean;
	perms: string[];
	/** 可进入后台：管理员，或持有任一后台权限点 */
	canAccessBackend: boolean;
	username: string;
	ability: AppAbility;
}

/**
 * 解析后台访问者：优先认传统 admin 会话；否则用 users 会话（role=admin 或持有权限点）。
 * 返回 null 表示未登录/无权限。
 */
export async function resolveBackendActor(
	request: Request,
	env: CloudflareEnv,
): Promise<BackendActor | null> {
	// 两条身份来源互不依赖，并行取回：串行会各付一次 D1 往返（跨区约 0.3s/次）
	const [adminUsername, identity] = await Promise.all([
		getAuthenticatedAdminUsername(request, env),
		getAuthIdentity(request, env),
	]);
	const user = identity?.user ?? null;
	const perms = identity ? identity.perms.filter(isKnownPerm) : [];
	const isAdmin = Boolean(adminUsername) || user?.role === "admin";
	const canAccessBackend = isAdmin || perms.some((p) => PERM_IDS.includes(p));

	if (!canAccessBackend) return null;

	const role = isAdmin ? "admin" : (user?.role ?? "user");
	return {
		viaAdminSession: Boolean(adminUsername),
		user,
		isAdmin,
		perms,
		canAccessBackend,
		username: adminUsername || user?.name || "",
		ability: buildAbility(role, perms),
	};
}

/** 用户侧：当前权限快照（供 /profile/ 与后台头部展示） */
export async function userPermSnapshot(
	db: CloudflareEnv["DB"],
	user: AuthUser,
): Promise<{
	isAdmin: boolean;
	perms: string[];
	requests: PermRequestRow[];
	catalog: PermSpec[];
}> {
	const isAdmin = user.role === "admin";
	const perms = isAdmin ? PERM_IDS : await listUserPerms(db, user.id);
	const requests = await listMyRequests(db, user.id);
	return { isAdmin, perms, requests, catalog: PERM_CATALOG };
}

/** 是否可进入后台（站长或持任一权限点） */
export async function canAccessBackend(
	request: Request,
	env: CloudflareEnv,
): Promise<boolean> {
	const actor = await resolveBackendActor(request, env);
	return Boolean(actor);
}

/** 文章写权限：站长或 post:create 持有者 */
export async function canWritePosts(
	request: Request,
	env: CloudflareEnv,
	action: "create" | "update" | "delete",
): Promise<boolean> {
	const actor = await resolveBackendActor(request, env);
	return Boolean(actor?.ability.can(action, "Post"));
}
