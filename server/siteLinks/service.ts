import { safeUrlScheme } from "../utils/safeUrl";
import { UserError } from "../utils/userError";
import { createCrudService } from "../utils/crud";
import type { CloudflareEnv } from "../../types/env";
import type { SiteLinkInput, SiteLinkKind, SiteLinkLocation, SiteLinkRecord, SiteLinkView } from "./types";

export type { SiteLinkInput, SiteLinkKind, SiteLinkLocation, SiteLinkRecord, SiteLinkView } from "./types";

const VALID_LOCATIONS: SiteLinkLocation[] = ["navbar", "footer", "profile", "sponsor"];
const VALID_KINDS: SiteLinkKind[] = ["link", "qr"];

function toView(row: SiteLinkRecord): SiteLinkView {
	return {
		id: row.id,
		name: row.name,
		url: row.url,
		icon: row.icon || "",
		location: (VALID_LOCATIONS.includes(row.location as SiteLinkLocation)
			? (row.location as SiteLinkLocation)
			: "navbar") as SiteLinkLocation,
		kind: (VALID_KINDS.includes(row.kind as SiteLinkKind)
			? (row.kind as SiteLinkKind)
			: "link") as SiteLinkKind,
		enabled: row.enabled === 1,
		sortOrder: Number(row.sort_order),
	};
}

interface SiteLinkNormalized {
	name: string;
	url: string;
	icon: string;
	location: SiteLinkLocation;
	kind: SiteLinkKind;
	sortOrder: number;
	enabled: number;
}

function normalizeInput(raw: SiteLinkInput): SiteLinkNormalized {
	const name = String(raw.name || "").trim();
	const url = String(raw.url || "").trim();
	const icon = String(raw.icon || "").trim();
	const location = (VALID_LOCATIONS.includes(raw.location as SiteLinkLocation)
		? (raw.location as SiteLinkLocation)
		: "navbar") as SiteLinkLocation;
	const kind = (VALID_KINDS.includes(raw.kind as SiteLinkKind)
		? (raw.kind as SiteLinkKind)
		: "link") as SiteLinkKind;
	const sortOrder = Number.isFinite(Number(raw.sortOrder))
		? Math.max(0, Math.round(Number(raw.sortOrder)))
		: 0;
	const enabled = raw.enabled === false ? 0 : 1;

	if (!name) throw new UserError("链接名称不能为空");
	if (!url) throw new UserError("链接地址不能为空");

	if (!safeUrlScheme(url)) throw new UserError("链接地址包含不支持的协议");

	return { name, url, icon, location, kind, sortOrder, enabled };
}

const service = createCrudService<SiteLinkRecord, SiteLinkInput, SiteLinkNormalized, SiteLinkView>({
	table: "site_links",
	columns: ["name", "url", "icon", "location", "kind", "sort_order", "enabled"],
	normalize: normalizeInput,
	toParams: (i) => [i.name, i.url, i.icon, i.location, i.kind, i.sortOrder, i.enabled],
	toView,
	orderBy: { list: "location ASC, sort_order ASC, id ASC", enabled: "location ASC, sort_order ASC, id ASC" },
	enabledFilter: (raw) =>
		VALID_LOCATIONS.includes(raw as SiteLinkLocation)
			? { sql: " AND location = ?", bind: [raw] }
			: null,
	notFoundMessage: "链接不存在",
});

export const listSiteLinks = service.list;

// 每请求记忆化：同一请求内多次按 location 查询只查一次全量（按请求对象缓存）
const linkCache = new WeakMap<object, Record<string, SiteLinkView[]>>();
export async function listEnabledSiteLinks(
	env: CloudflareEnv,
	location?: SiteLinkLocation,
	requestCache?: object,
): Promise<SiteLinkView[]> {
	if (requestCache) {
		let store = linkCache.get(requestCache);
		if (!store) {
			store = {};
			linkCache.set(requestCache, store);
		}
		const key = location ?? "__all";
		if (store[key]) return store[key];
		const all = await service.listEnabled(env);
		for (const l of all) (store[l.location] ??= []).push(l);
		store.__all = all;
		return store[key] ?? [];
	}
	return service.listEnabled(env, location);
}

export const getSiteLink = service.get;

export const createSiteLink = service.create;

export const updateSiteLink = service.update;

export const deleteSiteLink = service.remove;
