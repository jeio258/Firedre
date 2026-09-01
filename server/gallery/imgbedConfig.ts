

import type { CloudflareEnv } from "../../types/env";
import { getSettingsGroup } from "../settings/service";

export interface ImgbedConfig {

	enabled: boolean;

	endpoint: string;

	dir: string;

	token: string;
}

const GALLERY_GROUP = "gallery";

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
