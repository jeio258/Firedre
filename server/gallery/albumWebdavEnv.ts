import type {
	AlbumWebDavConfig,
	AlbumWebDavRuntimeOptions,
} from "../../types/album";
import type { CloudflareEnv } from "../../types/env";
import { UserError } from "../utils/userError";
import { getAlbumWebDavConfigFromR2 } from "./service";

export const WEBDAV_PASSWORD_ENV = "WEBDAV_PASSWORD";

export function getWebDavPassword(env?: CloudflareEnv) {
	return env?.WEBDAV_PASSWORD || process.env[WEBDAV_PASSWORD_ENV];
}

export async function resolveWebDavConfig(
	slug: string,
	options?: AlbumWebDavRuntimeOptions,
): Promise<
	AlbumWebDavConfig & { encrypted?: boolean; albumPassword?: string }
> {
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

	if (target.origin !== base.origin)
		throw new UserError("媒体地址不在相册范围内");

	// URL.pathname 保留百分号编码，且前缀匹配对 x/../../ 这类段归一化无效，
	// 须先解码再按段归一化（. 与 ..）后才可比对，否则 %2f 可编码穿越目录范围
	const basePath = normalizeDavPath(base.pathname);
	const targetPath = normalizeDavPath(target.pathname);
	if (targetPath !== basePath && !targetPath.startsWith(`${basePath}/`))
		throw new UserError("媒体地址不在相册范围内");
}

function normalizeDavPath(pathname: string): string {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		throw new UserError("非法媒体地址");
	}
	const segments: string[] = [];
	for (const seg of decoded.split("/")) {
		if (seg === "" || seg === ".") continue;
		if (seg === "..") {
			if (segments.length > 0) segments.pop();
			continue;
		}
		segments.push(seg);
	}
	return `/${segments.join("/")}`;
}
