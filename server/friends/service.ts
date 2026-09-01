import type { FriendInput, FriendRecord } from "../../types/friends";
import { UserError } from "../utils/userError";
import { isSafeHttpUrl } from "../utils/safeUrl";
import { createCrudService } from "../utils/crud";
// 统一 URL scheme 校验（白名单 http/https + 相对路径，拦截 javascript: 等存储型 XSS）
export { isSafeHttpUrl };

/** normalizeInput 的规范化产物（键序与 columns 一致） */
interface FriendNormalized {
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
	weight: number;
	enabled: number;
}

function normalizeInput(raw: FriendInput): FriendNormalized {
	const title = String(raw.title || "").trim();
	const imgurl = String(raw.imgurl || "").trim();
	const siteurl = String(raw.siteurl || "").trim();

	if (!title) throw new UserError("友链名称不能为空");
	if (!imgurl) throw new UserError("友链头像不能为空");
	if (!siteurl) throw new UserError("友链地址不能为空");

	// 仅允许安全 URL scheme，拦截 javascript:/data:/vbscript: 等存储型 XSS
	if (!isSafeHttpUrl(siteurl)) throw new UserError("友链地址仅支持 http/https 或相对路径");
	if (!isSafeHttpUrl(imgurl)) throw new UserError("友链头像仅支持 http/https 或相对路径");

	const tags = Array.isArray(raw.tags)
		? raw.tags.map((t) => String(t).trim()).filter(Boolean)
		: String(raw.tags || "")
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);

	const weight = Number.isFinite(Number(raw.weight))
		? Math.max(0, Math.round(Number(raw.weight)))
		: 0;

	return {
		title,
		imgurl,
		desc: String(raw.desc || "").trim(),
		siteurl,
		tags: tags.slice(0, 20),
		weight,
		enabled: raw.enabled === false ? 0 : 1,
	};
}

const service = createCrudService<FriendRecord, FriendInput, FriendNormalized>({
	table: "friends",
	columns: ["title", "imgurl", "desc", "siteurl", "tags", "weight", "enabled"],
	normalize: normalizeInput,
	toParams: (i) => [
		i.title,
		i.imgurl,
		i.desc,
		i.siteurl,
		i.tags.join(","),
		i.weight,
		i.enabled,
	],
	orderBy: { list: "weight DESC, id ASC", enabled: "weight DESC, id ASC" },
	notFoundMessage: "友链不存在",
});

/** 前台展示：仅启用且按权重降序 */
export const listEnabledFriends = service.listEnabled;

/** 后台管理：全部友链，按权重降序 */
export const listFriends = service.list;

export const getFriend = service.get;

export const createFriend = service.create;

export const updateFriend = service.update;

export const deleteFriend = service.remove;
