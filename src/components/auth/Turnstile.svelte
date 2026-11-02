<script lang="ts">
import { onMount } from "svelte";

// Cloudflare Turnstile：siteKey 为空（未配置凭据）时不渲染，后端同步跳过校验。
// token 通过 bind:token 回填父表单；过期/出错清空，避免提交无法通过的旧 token。

interface Props {
	siteKey?: string;
	token?: string;
	action?: string;
	theme?: "auto" | "light" | "dark";
}

const envSiteKey =
	(import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

let {
	siteKey = envSiteKey,
	token = $bindable(""),
	action = "login",
	theme = "auto",
}: Props = $props();

let container: HTMLDivElement | undefined = $state();
let widgetId = $state<string | number | null>(null);
let renderFailed = $state(false);
// challenges.cloudflare.com 的连接重置是间歇性的，单次失败不代表后续也失败，故退避重试
const MAX_RETRIES = 8;
const RETRY_BASE_MS = 2000;
let retryingCount = $state(0);

const API_SRC =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScriptOnce(): Promise<void> {
	if ((window as unknown as { turnstile?: unknown }).turnstile) {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			'script[src^="https://challenges.cloudflare.com/turnstile"]',
		);
		if (existing) {
			existing.addEventListener("load", () => resolve(), { once: true });
			existing.addEventListener("error", () => reject(new Error("load fail")), {
				once: true,
			});
			return;
		}
		const script = document.createElement("script");
		script.src = API_SRC;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			// 失败的 script 必须移除，否则下次重试命中 existing 分支永久挂起
			script.remove();
			reject(new Error("load fail"));
		};
		document.head.appendChild(script);
	});
}

async function loadScript(): Promise<void> {
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			retryingCount = attempt;
			await new Promise((r) => setTimeout(r, RETRY_BASE_MS * attempt));
		}
		try {
			await loadScriptOnce();
			retryingCount = 0;
			return;
		} catch {
			// 继续重试
		}
	}
	retryingCount = 0;
	throw new Error("load fail after retries");
}

onMount(() => {
	if (!siteKey || !container) return;

	let disposed = false;
	loadScript()
		.then(() => {
			if (disposed || !container) return;
			const api = (
				window as unknown as {
					turnstile?: {
						render: (
							el: HTMLElement,
							opts: Record<string, unknown>,
						) => string | number;
						remove: (id?: string | number) => void;
					};
				}
			).turnstile;
			if (!api) {
				renderFailed = true;
				return;
			}
			try {
				widgetId = api.render(container, {
					sitekey: siteKey,
					action,
					theme,
					retry: "never",
					"refresh-expired": "never",
					callback: (t: string) => {
						token = t;
					},
					"expired-callback": () => {
						token = "";
					},
					"error-callback": () => {
						token = "";
					},
				});
			} catch (error) {
				renderFailed = true;
				console.error("[turnstile] render 失败:", error);
			}
		})
		.catch(() => {
			renderFailed = true;
			token = "";
		});

	return () => {
		disposed = true;
		const api = (
			window as unknown as {
				turnstile?: { remove: (id?: string | number) => void };
			}
		).turnstile;
		if (widgetId !== null && api) {
			try {
				api.remove(widgetId);
			} catch {
				// 实例可能已随 DOM 移除
			}
			widgetId = null;
		}
	};
});

/** 提交失败后重置：旧 token 已消费/失效，必须换新 */
export function reset() {
	token = "";
	const api = (
		window as unknown as {
			turnstile?: { reset: (id?: string | number) => void };
		}
	).turnstile;
	if (widgetId !== null && api) {
		try {
			api.reset(widgetId);
		} catch {
			// widget 已销毁
		}
	}
}
</script>

{#if siteKey}
	<div class="my-3">
		<div bind:this={container} class="turnstile-slot"></div>
		{#if retryingCount > 0}
			<p class="text-xs text-50 mt-1">
				人机验证组件加载中（重试 {retryingCount}/{MAX_RETRIES}）…
			</p>
		{:else if renderFailed}
			<p class="text-xs text-red-500 mt-1">人机验证组件加载失败，请检查网络后刷新页面</p>
		{/if}
	</div>
{/if}

<style>
	.turnstile-slot {
		min-height: 65px;
		display: flex;
		justify-content: center;
	}
</style>
