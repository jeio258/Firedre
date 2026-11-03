<script lang="ts">
import type { OAuthProviderId } from "@server/auth/oauth";
import {
	isOAuthErrorCode,
	OAUTH_ERROR_MESSAGES,
} from "@server/auth/oauthErrors";
import { onMount } from "svelte";
import Turnstile from "./Turnstile.svelte";

// 查询串一律在客户端读取：HTML 会按 path 被缓存，把 next/oauth_error 烘进 SSR 会把
// 上一个访客的回跳目标串给其他人。

interface Props {
	// 仅由服务端判定「凭据是否配置」后下发；空数组即不渲染第三方登录区
	oauthProviders?: OAuthProviderId[];
}

let { oauthProviders = [] }: Props = $props();

const OAUTH_LABELS: Record<OAuthProviderId, string> = {
	github: "GitHub",
	google: "Google",
};

type Mode = "login" | "forgot" | "sent" | "reset";

let mode = $state<Mode>("login");
let next = $state("");
let resetToken = $state("");

let email = $state("");
let password = $state("");
let remember = $state(true);
let error = $state("");
let loading = $state(false);
let sentTo = $state("");

let newPassword = $state("");
let confirmPassword = $state("");

let turnstileToken = $state("");
let turnstileRef = $state<Turnstile | null>(null);

const inputClass =
	"w-full px-4 py-3 text-[15px] bg-transparent border border-black/10 dark:border-white/10 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-(--primary) focus:border-(--primary) placeholder:opacity-50 text-90";

/** 站内跳转校验（防 open redirect） */
function safeNext(value: string): string {
	if (!value) return "";
	if (!value.startsWith("/") || value.startsWith("//")) return "";
	return value;
}

onMount(() => {
	const params = new URLSearchParams(window.location.search);
	next = safeNext(params.get("next") ?? "");

	const oauthError = params.get("oauth_error");
	if (oauthError) {
		error = isOAuthErrorCode(oauthError)
			? OAUTH_ERROR_MESSAGES[oauthError]
			: "第三方登录失败，请重试";
		params.delete("oauth_error");
		const qs = params.toString();
		history.replaceState(
			null,
			"",
			window.location.pathname + (qs ? `?${qs}` : ""),
		);
	}

	const reset = params.get("token") ?? "";
	if (params.get("mode") === "reset" && reset) {
		resetToken = reset;
		mode = "reset";
		// 一次性凭据不留在地址栏/历史里
		params.delete("token");
		params.delete("mode");
		const qs = params.toString();
		history.replaceState(
			null,
			"",
			window.location.pathname + (qs ? `?${qs}` : ""),
		);
		return;
	}
	if (params.get("mode") === "forgot") {
		mode = "forgot";
		return;
	}

	// 已登录直接落地，避免重复登录
	fetch("/api/auth/me/", { credentials: "same-origin" })
		.then((resp) => resp.json())
		.then((data) => {
			if (data?.authenticated) {
				// 非管理员回跳 /admin/ 会被后台 401 再踢回登录页，形成来回跳转
				const target =
					next.startsWith("/admin") && data.isAdmin !== true
						? "/profile/"
						: next || "/profile/";
				window.location.replace(target);
				return;
			}
			document.querySelector<HTMLInputElement>("#auth-email")?.focus();
		})
		.catch(() => {
			// 自查失败不阻断登录表单
		});
});

function switchMode(target: Mode) {
	mode = target;
	error = "";
	loading = false;
	turnstileToken = "";
}

async function submit(event: SubmitEvent) {
	event.preventDefault();
	if (loading) return;
	error = "";
	loading = true;
	try {
		const resp = await fetch("/api/auth/login/", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: email.trim(),
				password,
				remember,
				turnstileToken,
			}),
		});
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok || !data.ok) {
			error = data.message || "登录失败，请稍后再试";
			turnstileRef?.reset();
			turnstileToken = "";
			return;
		}
		window.location.href = next || "/profile/";
	} catch {
		error = "网络错误，请重试";
	} finally {
		loading = false;
	}
}

async function submitForgot(event: SubmitEvent) {
	event.preventDefault();
	if (loading) return;
	error = "";
	loading = true;
	try {
		const target = email.trim();
		const resp = await fetch("/api/auth/forgot/", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: target }),
		});
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok) {
			error = data.message || "发送失败，请稍后再试";
			return;
		}
		sentTo = target;
		mode = "sent";
	} catch {
		error = "网络错误，请重试";
	} finally {
		loading = false;
	}
}

async function submitReset(event: SubmitEvent) {
	event.preventDefault();
	if (loading) return;
	error = "";
	if (newPassword !== confirmPassword) {
		error = "两次输入的新密码不一致";
		return;
	}
	loading = true;
	try {
		const resp = await fetch("/api/auth/reset/", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: resetToken, password: newPassword }),
		});
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok || !data.ok) {
			error = data.message || "重置失败，链接可能已过期";
			return;
		}
		window.location.href = next || "/profile/";
	} catch {
		error = "网络错误，请重试";
	} finally {
		loading = false;
	}
}
</script>

<div class="card-base w-full px-7 py-8 rounded-(--radius-large)">
	{#if mode === "sent"}
		<div class="text-center py-2">
			<div
				class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-(--primary)/10 mb-4"
			>
				<svg
					class="w-7 h-7 text-(--primary)"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<h2 class="text-xl font-bold text-90">重置邮件已发送</h2>
			<p class="text-sm text-50 mt-2 leading-relaxed">
				已发送至 <span class="text-75 font-medium">{sentTo}</span><br />
				请点击邮件中的链接设置新密码（1 小时内有效）。
			</p>
			<div class="mt-6">
				<button
					type="button"
					onclick={() => switchMode("forgot")}
					class="w-full rounded-xl border border-(--line-divider) bg-(--card-bg) px-6 py-2.5 text-sm font-medium text-75 transition-colors hover:border-(--primary)/40 hover:text-(--primary-text)"
				>
					没收到？重新发送
				</button>
			</div>
			<p class="text-center text-sm text-50 mt-4">
				<a
					href={next ? `/login/?next=${encodeURIComponent(next)}` : "/login/"}
					data-no-swup
					class="text-(--primary-text) font-medium hover:underline">返回登录</a
				>
			</p>
		</div>
	{:else if mode === "forgot"}
		<div class="text-center mb-6">
			<div
				class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-(--primary)/10 mb-4"
			>
				<svg
					class="w-7 h-7 text-(--primary)"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
					/>
				</svg>
			</div>
			<h2 class="text-xl font-bold text-90">重置密码</h2>
			<p class="text-sm text-50 mt-1">输入注册邮箱，我们会发送重置链接（1 小时内有效）</p>
		</div>

		{#if error}
			<p
				class="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-600 dark:text-red-400"
			>
				{error}
			</p>
		{/if}

		<form onsubmit={submitForgot} class="space-y-4">
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">注册邮箱</span>
				<input
					type="email"
					autocomplete="email"
					required
					bind:value={email}
					class={inputClass}
					placeholder="you@example.com"
				/>
			</label>
			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-xl bg-(--primary-fill) px-6 py-3 text-sm font-semibold text-(--primary-on-fill) transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{loading ? "发送中…" : "发送重置邮件"}
			</button>
		</form>

		<p class="text-center text-sm text-50 mt-6">
			<button type="button" class="hover:underline" onclick={() => switchMode("login")}>
				← 返回登录
			</button>
		</p>
	{:else if mode === "reset"}
		<div class="text-center mb-6">
			<div
				class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-(--primary)/10 mb-4"
			>
				<svg
					class="w-7 h-7 text-(--primary)"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
					/>
				</svg>
			</div>
			<h2 class="text-xl font-bold text-90">设置新密码</h2>
			<p class="text-sm text-50 mt-1">设置完成后将自动登录</p>
		</div>

		{#if error}
			<p
				class="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-600 dark:text-red-400"
			>
				{error}
			</p>
		{/if}

		<form onsubmit={submitReset} class="space-y-4">
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">新密码</span>
				<input
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					maxlength="128"
					bind:value={newPassword}
					class={inputClass}
					placeholder="至少 8 位"
				/>
			</label>
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">确认新密码</span>
				<input
					type="password"
					autocomplete="new-password"
					required
					bind:value={confirmPassword}
					class={inputClass}
					placeholder="再次输入新密码"
				/>
			</label>
			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-xl bg-(--primary-fill) px-6 py-3 text-sm font-semibold text-(--primary-on-fill) transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{loading ? "提交中…" : "设置新密码"}
			</button>
		</form>
	{:else}
		<div class="text-center mb-6">
			<div
				class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-(--primary)/10 mb-4"
			>
				<svg
					class="w-7 h-7 text-(--primary)"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
					/>
				</svg>
			</div>
			<h2 class="text-xl font-bold text-90">欢迎回来 👋</h2>
			<p class="text-sm text-50 mt-1">登录以参与评论与互动</p>
		</div>

		{#if error}
			<p
				class="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-600 dark:text-red-400"
			>
				{error}
			</p>
		{/if}

		<form onsubmit={submit} class="space-y-4">
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">邮箱</span>
				<input
					id="auth-email"
					type="email"
					autocomplete="email"
					required
					bind:value={email}
					class={inputClass}
					placeholder="you@example.com"
				/>
			</label>
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">密码</span>
				<input
					type="password"
					autocomplete="current-password"
					required
					bind:value={password}
					class={inputClass}
					placeholder="请输入密码"
				/>
			</label>

			<div class="flex items-center justify-between text-sm">
				<label class="flex items-center gap-2 cursor-pointer text-75">
					<input
						type="checkbox"
						bind:checked={remember}
						class="accent-(--primary) w-4 h-4"
					/>
					<span>记住我（30 天）</span>
				</label>
				<button
					type="button"
					class="text-(--primary-text) hover:underline"
					onclick={() => switchMode("forgot")}
				>
					忘记密码？
				</button>
			</div>

			<Turnstile bind:this={turnstileRef} bind:token={turnstileToken} action="login" />

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-xl bg-(--primary-fill) px-6 py-3 text-sm font-semibold text-(--primary-on-fill) transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{loading ? "登录中…" : "登 录"}
			</button>
		</form>

		{#if oauthProviders.length > 0}
			<div class="mt-6 mb-4 flex items-center gap-3 text-xs text-50">
				<span class="h-px flex-1 bg-(--line-divider)"></span>
				<span>或使用以下方式登录</span>
				<span class="h-px flex-1 bg-(--line-divider)"></span>
			</div>
			<div class="space-y-2.5">
				{#each oauthProviders as provider (provider)}
					<a
						href={`/api/auth/oauth/${provider}/start/${next ? `?next=${encodeURIComponent(next)}` : ""}`}
						data-no-swup
						class="flex w-full items-center justify-center gap-2.5 rounded-xl border border-(--line-divider) bg-(--card-bg) px-4 py-2.5 text-sm text-75 transition-colors hover:border-(--primary)/40 hover:text-(--primary-text)"
					>
						使用 {OAUTH_LABELS[provider]} 登录
					</a>
				{/each}
			</div>
		{/if}

		<p class="text-center text-sm text-50 mt-6">
			还没有账号？
			<a href="/register/" data-no-swup class="text-(--primary-text) font-medium hover:underline"
				>立即注册</a
			>
		</p>
	{/if}
</div>
