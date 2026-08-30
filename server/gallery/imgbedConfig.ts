/**
 * 图床全局配置（图传 API 方式）。
 *
 * 方案①：相册图片通过「图床 API 端点 + API 密钥」获取，而不是手填 WebDAV 变量。
 * 端点与密钥是全局配置（后台「站点设置 → 相册」），所有相册共用；
 * 每个相册用自身 slug 作为图床目录（dir={slug}）从图床拉取图片直链，写入 frontmatter.photos。
 *
 * 存储位置：site_settings.gallery 组（JSON），key 命名含 token → 公开 GET /api/settings/
 * 会被 SENSITIVE_SETTING_KEY 正则自动脱敏，token 绝不下发到公开前端 JS。
 */

import type { CloudflareEnv } from "../../types/env";
import { getSettingsGroup } from "../settings/service";

export interface ImgbedConfig {
	/** 是否启用图床 API 方式 */
	enabled: boolean;
	/** 图床 API 端点（如 https://cfbed.sanyue.de），可自定义、可切换任意兼容图床 */
	endpoint: string;
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
	const token = String(group.imgbedToken || "").trim();
	const enabled = group.imgbedEnabled === true;

	if (!enabled || !endpoint || !token) return null;
	return { enabled, endpoint: endpoint.replace(/\/$/, ""), token };
}
