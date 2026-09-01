import type { AlbumWebDavConfig } from "../types/album";
import type { CloudflareEnv } from "../types/env";
import { UserError } from "./utils/userError";
import { getAlbumWebDavConfigFromR2 } from "./gallery/service";

export const WEBDAV_PASSWORD_ENV = "WEBDAV_PASSWORD";

export interface AlbumWebDavRuntimeOptions {
	env?: CloudflareEnv;
}

export function getWebDavPassword(env?: CloudflareEnv) {
	return env?.WEBDAV_PASSWORD || process.env[WEBDAV_PASSWORD_ENV];
}

/**
 * 解析相册 WebDAV 配置：
 * - url/username 来自 R2 中相册 index.md 的 webdav frontmatter
 * - password 来自环境变量 WEBDAV_PASSWORD
 */
export async function resolveWebDavConfig(
	slug: string,
	options?: AlbumWebDavRuntimeOptions,
): Promise<AlbumWebDavConfig & { encrypted?: boolean; albumPassword?: string }> {
	if (!slug) throw new UserError("缺少相册标识");

	const env = options?.env;
	if (!env) throw new UserError("缺少 Cloudflare 环境绑定");

	const registered = await getAlbumWebDavConfigFromR2(env, slug);
	if (!registered?.url?.trim())
		throw new UserError(
			`未找到 WebDAV 相册配置，请检查相册 ${slug}/index.md 的 webdav 字段`,
		);

	const password = getWebDavPassword(env);
	if (!password)
		throw new UserError(`未配置 WebDAV 密码环境变量 ${WEBDAV_PASSWORD_ENV}`);

	return {
		url: registered.url.trim(),
		username: registered.username?.trim() || undefined,
		password,
		encrypted: registered.encrypted === true,
		albumPassword: registered.albumPassword,
	};
}

export function assertTargetInWebDavScope(targetUrl: string, baseUrl: string) {
	const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

	let target: URL;
	let base: URL;
	try {
		target = new URL(targetUrl);
		base = new URL(normalizedBase);
	} catch {
		throw new UserError("非法媒体地址");
	}

	if (target.origin !== base.origin) throw new UserError("媒体地址不在相册范围内");

	// 路径段边界判断：basePath 后必须紧跟 `/`、查询串或结束，
	// 防止 `/album/` 误放行 `/album-evil/` 这类同前缀不同段的目标。
	const basePath = base.pathname.replace(/\/$/, "") || "/";
	const targetPath = target.pathname;
	if (targetPath !== basePath && !targetPath.startsWith(`${basePath}/`))
		throw new UserError("媒体地址不在相册范围内");
}
