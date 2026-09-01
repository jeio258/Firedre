/**
 * 图床全局配置（图传 API 方式）。
 *
 * 方案①：相册图片通过「图床 API 端点 + API 密钥」获取，而不是手填 WebDAV 变量。
 * 端点与密钥是全局配置（后台「站点设置 → 相册」），所有相册共用；
 * 图床目录（?dir=）由用户在相册编辑页填写，存全局配置；留空 = 根目录。
 * 相册 slug 优先级最高，不被 ?dir= 覆盖。
 *
 * 存储位置：site_settings.gallery 组（JSON），key 命名含 token → 公开 GET /api/settings/
 * 会被 SENSITIVE_SETTING_KEY 正则自动脱敏，token 绝不下发到公开前端 JS。
 */

import type { CloudflareEnv } from "../../types/env";
import { getSettingsGroup } from "../settings/service";

export interface ImgbedConfig {
	/** 是否启用图床 API 方式 */
	enabled: boolean;
	/** 图床列表接口完整 URL（用户直接填写，如 https://imge.994613.xyz/api/manage/list） */
	endpoint: string;
	/** 图床目录（可选，用户自行填写，作为 ?dir= 参数；留空 = 根目录） */
	dir: string;
	/** API 密钥（Bearer token），仅服务端读取，用于列目录/管理请求 */
	token: string;
}

const GALLERY_GROUP = "gallery";

/** 读取全局图床配置（未配置或未启用时返回 null） */
export async function getImgbedConfig(
	env: CloudflareEnv,
): Promise<ImgbedConfig | null> {
	const group = await getSettingsGroup(env, GALLERY_GROUP);
	const endpoint = String(group.imgbedEndpoint || "").trim();
	const dir = String(group.imgbedDir || "").trim();
	const token = String(group.imgbedToken || "").trim();
	const enabled = group.imgbedEnabled === true;

	if (!enabled || !endpoint || !token) return null;
	return {
		enabled,
		// 端点即完整列表接口 URL，直接使用，不拼接、不裁剪尾部斜杠
		endpoint,
		dir,
		token,
	};
}
