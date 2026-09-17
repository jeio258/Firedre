/**
 * 洛雪音乐音源宿主：执行洛雪格式音源脚本并调用其解析接口。
 * 脚本契约见 https://lxmusic.toside.cn/desktop/custom-source
 *
 * 运行方式说明：workerd 禁止运行时 codegen（new Function / eval），
 * 因此音源脚本经 Vite 构建期打包为模块，执行前把宿主对象挂到 globalThis.lx。
 */

export type LxCapability = {
	name: string;
	type: string;
	actions: string[];
	qualitys: string[];
};

export type LxMusicInfo = Record<string, unknown>;

export type LxSource = {
	capabilities: Record<string, LxCapability>;
	getMusicUrl(
		source: string,
		musicInfo: LxMusicInfo,
		quality: string,
	): Promise<string>;
};

export class LxError extends Error {}

type LxRequestPayload = {
	source: string;
	action: string;
	info: { musicInfo: LxMusicInfo; type?: string | null };
};

type LxHandler = (payload: LxRequestPayload) => Promise<unknown>;

const INITED_WAIT_MS = 10_000;
const POLL_MS = 50;

// 音源初始化只执行一次，之后复用（失败时清空以便重试）
let cachedSource: Promise<LxSource> | null = null;

export function getLxSource(): Promise<LxSource> {
	if (!cachedSource) {
		cachedSource = initLxSource().catch((error: unknown) => {
			cachedSource = null;
			throw error;
		});
	}
	return cachedSource;
}

async function initLxSource(): Promise<LxSource> {
	const handlers = new Map<string, LxHandler>();
	const state: { capabilities: Record<string, LxCapability> | null } = {
		capabilities: null,
	};

	const lx = {
		version: "2.0.0",
		env: "desktop",
		currentScriptInfo: {
			name: "",
			description: "",
			version: "",
			author: "",
			homepage: "",
			rawScript: "",
		},
		EVENT_NAMES: {
			inited: "inited",
			request: "request",
			updateAlert: "updateAlert",
		},
		on(event: string, handler: LxHandler) {
			handlers.set(event, handler);
		},
		send(event: string, data: unknown) {
			if (event === "inited") {
				state.capabilities =
					(data as { sources?: Record<string, LxCapability> })?.sources ?? {};
			}
		},
		// 脚本的网络请求入口（workerd 内 fetch 不受跨域限制）
		request(
			url: string,
			optionsOrCallback:
				| (RequestInit & { form?: Record<string, string> })
				| ((...args: unknown[]) => void) = {},
			maybeCallback?: (
				err: unknown,
				resp: {
					statusCode: number;
					headers: Record<string, string>;
					body: string;
				} | null,
				body: string | null,
			) => void,
		) {
			const options =
				typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
			const callback =
				typeof optionsOrCallback === "function"
					? optionsOrCallback
					: maybeCallback;
			const controller = new AbortController();
			(async () => {
				try {
					const headers: Record<string, string> = {
						...((options.headers as Record<string, string>) ?? {}),
					};
					let body: BodyInit | undefined;
					if (options.form) {
						body = new URLSearchParams(options.form).toString();
						headers["content-type"] = "application/x-www-form-urlencoded";
					} else if (options.body) {
						body = options.body as BodyInit;
					}
					const res = await fetch(url, {
						method: options.method ?? "GET",
						headers,
						body,
						signal: controller.signal,
					});
					const text = await res.text();
					callback?.(
						null,
						{
							statusCode: res.status,
							headers: Object.fromEntries(res.headers),
							body: text,
						},
						text,
					);
				} catch (error) {
					callback?.(error, null, null);
				}
			})();
			return () => controller.abort();
		},
		// 本音源未使用 utils；保留空对象避免脚本访问时抛错
		utils: { buffer: {}, crypto: {}, zlib: {} },
	};

	(globalThis as unknown as { lx?: unknown }).lx = lx;
	// 构建期已打包为模块，此处仅触发执行（脚本会读取 globalThis.lx）
	// 音源脚本为无导出的 IIFE，故忽略模块类型检查
	// @ts-expect-error
	await import("../music-sources/kh-v1.7.16.js");

	const deadline = Date.now() + INITED_WAIT_MS;
	while (state.capabilities === null && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
	if (state.capabilities === null) throw new LxError("音源初始化失败或超时");
	const requestHandler = handlers.get("request");
	if (!requestHandler) throw new LxError("音源未注册 request 处理器");

	return {
		capabilities: state.capabilities,
		async getMusicUrl(source, musicInfo, quality) {
			const result = await requestHandler({
				source,
				action: "musicUrl",
				info: { musicInfo: { ...musicInfo, source }, type: quality },
			});
			const url =
				typeof result === "string" ? result : (result as { url?: string })?.url;
			if (!url || !/^https?:\/\//.test(url)) {
				throw new LxError(
					typeof result === "string" && result
						? result
						: "音源未返回有效播放链接",
				);
			}
			return url;
		},
	};
}
