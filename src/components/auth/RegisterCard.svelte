<script lang="ts">
import { onDestroy, onMount } from "svelte";
import Turnstile from "./Turnstile.svelte";

// 双模式：users 表为空 → 初始化站长（建完即登录）；否则普通注册（邮箱验证码）。
// setup-status 在客户端拉取：页面 HTML 按 path 缓存，模式不能烘进 SSR。

type Mode = "loading" | "setup" | "normal" | "closed" | "code" | "error";

let mode = $state<Mode>("loading");
let hasLegacyAdmin = $state(false);

let name = $state("");
let email = $state("");
let password = $state("");
let confirmPassword = $state("");
let legacyPassword = $state("");
let error = $state("");
let loading = $state(false);
let turnstileToken = $state("");
let turnstileRef = $state<Turnstile | null>(null);

let mailState = $state<"sent" | "failed" | "not_ready">("sent");
let devCode = $state("");
let code = $state("");
let verifyLoading = $state(false);
let resendLoading = $state(false);
let resendMsg = $state("");
let countdown = $state(0);
let timer: ReturnType<typeof setInterval> | undefined;

function startCountdown() {
	clearInterval(timer);
	countdown = 60;
	timer = setInterval(() => {
		countdown -= 1;
		if (countdown <= 0) clearInterval(timer);
	}, 1000);
}

onDestroy(() => clearInterval(timer));

const inputClass =
	"w-full px-4 py-3 text-[15px] bg-transparent border border-black/10 dark:border-white/10 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-(--primary) focus:border-(--primary) placeholder:opacity-50 text-90";

onMount(async () => {
	try {
		const resp = await fetch("/api/auth/setup-status/", {
			credentials: "same-origin",
		});
		if (!resp.ok) throw new Error(`setup-status ${resp.status}`);
		const data = await resp.json();
		hasLegacyAdmin = Boolean(data?.hasLegacyAdmin);
		// 初始化优先于注册开关：站点尚无用户时必须允许创建站长，否则永远进不去后台
		if (data?.needsSetup) {
			mode = "setup";
			return;
		}
		mode = data?.allowRegistration === false ? "closed" : "normal";
	} catch {
		mode = "error";
	}
});

async function submit(event: SubmitEvent) {
	event.preventDefault();
	if (loading) return;
	error = "";

	if (password !== confirmPassword) {
		error = "两次输入的密码不一致";
		return;
	}

	loading = true;
	try {
		const resp = await fetch("/api/auth/register/", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: name.trim(),
				email: email.trim(),
				password,
				turnstileToken,
				...(mode === "setup" && hasLegacyAdmin
					? { legacyPassword }
					: undefined),
			}),
		});
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok || !data.ok) {
			error = data.message || "提交失败，请稍后再试";
			turnstileRef?.reset();
			turnstileToken = "";
			return;
		}
		if (mode === "setup" || data.loggedIn) {
			window.location.replace("/admin/");
			return;
		}
		mailState =
			data.mailState === "failed" || data.mailState === "not_ready"
				? data.mailState
				: "sent";
		devCode = typeof data.devCode === "string" ? data.devCode : "";
		code = "";
		resendMsg = "";
		mode = "code";
		startCountdown();
	} catch {
		error = "网络错误，请重试";
	} finally {
		loading = false;
	}
}

async function submitCode(event: SubmitEvent) {
	event.preventDefault();
	if (verifyLoading) return;
	if (!/^\d{6}$/.test(code)) {
		error = "请输入 6 位数字验证码";
		return;
	}
	error = "";
	verifyLoading = true;
	try {
		const resp = await fetch("/api/auth/verify-code/", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: email.trim(), code }),
		});
		const data = await resp.json().catch(() => ({}));
		if (resp.ok && data.ok && data.loggedIn) {
			window.location.replace("/profile/?verified=1");
			return;
		}
		error = data.message || "验证码错误或已过期，请重试或重新获取";
	} catch {
		error = "网络错误，请重试";
	} finally {
		verifyLoading = false;
	}
}

async function resend() {
	if (resendLoading || countdown > 0) return;
	resendMsg = "";
	error = "";
	resendLoading = true;
	try {
		const resp = await fetch("/api/auth/resend/", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: email.trim() }),
		});
		const data = await resp.json().catch(() => ({}));
		resendMsg =
			data.message ||
			(resp.ok ? "验证码已发送，请查收。" : "发送失败，请稍后再试");
		if (resp.ok) startCountdown();
	} catch {
		resendMsg = "网络错误，请重试";
	} finally {
		resendLoading = false;
	}
}
</script>

<div class="card-base w-full px-7 py-8 rounded-(--radius-large)">
	{#if mode === "loading"}
		<p class="text-center text-sm text-50 py-6">加载中…</p>
	{:else if mode === "error"}
		<div class="text-center py-2">
			<h2 class="text-xl font-bold text-90">无法获取站点状态</h2>
			<p class="text-sm text-50 mt-2">请刷新页面重试，或稍后再访问。</p>
		</div>
	{:else if mode === "closed"}
		<div class="text-center py-2">
			<h2 class="text-xl font-bold text-90">本站暂未开放注册</h2>
			<p class="text-sm text-50 mt-2 leading-relaxed">
				当前只开放已有账号登录，如需账号请联系站长。
			</p>
			<a
				href="/login/"
				data-no-swup
				class="mt-6 inline-block rounded-xl bg-(--primary-fill) px-8 py-2.5 text-sm font-semibold text-(--primary-on-fill) transition-all hover:brightness-110"
				>去登录</a
			>
		</div>
	{:else if mode === "code"}
		<div class="text-center py-2">
			<div
				class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 mb-4"
			>
				<svg
					class="w-7 h-7 text-green-500"
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
			<h2 class="text-xl font-bold text-90">
				{mailState === "sent" ? "输入邮箱验证码" : "账号已创建，但验证码未发出"}
			</h2>
			<p class="text-sm text-50 mt-2 leading-relaxed">
				{#if mailState === "sent"}
					我们已向 <span class="text-75 font-medium">{email}</span> 发送了 6 位验证码，<br />
					请在下方输入完成验证（10 分钟内有效）。
				{:else}
					账号已创建成功，但发信服务器拒绝了这次投递（配置未就绪或凭据失效）。<br />
					请稍后点下方「重新发送」重试；若仍收不到，请联系站长处理。
				{/if}
			</p>
		</div>

		{#if devCode}
			<p
				class="mt-4 rounded-lg bg-(--primary)/10 border border-(--primary)/30 px-4 py-2.5 text-sm text-75 text-center"
			>
				本地联调：验证码 <span class="font-bold tracking-widest">{devCode}</span>（仅调试显示）
			</p>
		{/if}

		{#if error}
			<p
				class="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-600 dark:text-red-400"
			>
				{error}
			</p>
		{/if}

		{#if resendMsg}
			<p
				class="mt-4 rounded-lg bg-(--primary)/10 border border-(--primary)/30 px-4 py-2.5 text-sm text-75"
			>
				{resendMsg}
			</p>
		{/if}

		{#if mailState === "sent"}
			<form onsubmit={submitCode} class="mt-6 space-y-3">
				<input
					type="text"
					inputmode="numeric"
					autocomplete="one-time-code"
					required
					bind:value={code}
					oninput={() => (code = code.replace(/\D/g, "").slice(0, 6))}
					class={`${inputClass} text-center text-2xl tracking-[0.5em] font-semibold`}
					placeholder="······"
				/>
				<button
					type="submit"
					disabled={verifyLoading || code.length !== 6}
					class="w-full rounded-xl bg-(--primary-fill) px-6 py-3 text-sm font-semibold text-(--primary-on-fill) transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{verifyLoading ? "验证中…" : "验证并登录"}
				</button>
			</form>
		{/if}

		<div class="mt-6 space-y-3">
			<button
				type="button"
				onclick={resend}
				disabled={resendLoading || countdown > 0}
				class="w-full rounded-xl border border-(--line-divider) bg-(--card-bg) px-6 py-2.5 text-sm font-medium text-75 transition-colors hover:border-(--primary)/40 hover:text-(--primary-text) disabled:opacity-60"
			>
				{resendLoading
					? "发送中…"
					: countdown > 0
						? `重新发送（${countdown}s）`
						: "没收到验证码？重新发送"}
			</button>
			<a
				href="/login/"
				data-no-swup
				class="block w-full rounded-xl border border-(--line-divider) bg-(--card-bg) px-6 py-2.5 text-sm font-medium text-75 text-center transition-colors hover:border-(--primary)/40 hover:text-(--primary-text)"
			>
				去登录
			</a>
		</div>
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
						d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
					/>
				</svg>
			</div>
			<h2 class="text-xl font-bold text-90">
				{mode === "setup" ? "初始化站点" : "创建账号"}
			</h2>
			<p class="text-sm text-50 mt-1">
				{mode === "setup"
					? "这将是本站的站长账号，创建后自动登录"
					: "注册后需验证邮箱，即可参与评论与互动"}
			</p>
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
				<span class="block text-sm text-75 mb-1.5">昵称</span>
				<input
					type="text"
					autocomplete="nickname"
					required
					maxlength="30"
					bind:value={name}
					class={inputClass}
					placeholder="怎么称呼你（30 字以内）"
				/>
			</label>
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">邮箱</span>
				<input
					type="email"
					autocomplete="email"
					required
					bind:value={email}
					class={inputClass}
					placeholder={mode === "setup" ? "站长登录邮箱" : "用于接收验证邮件"}
				/>
			</label>
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">密码</span>
				<input
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					maxlength="128"
					bind:value={password}
					class={inputClass}
					placeholder="至少 8 位"
				/>
			</label>
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">确认密码</span>
				<input
					type="password"
					autocomplete="new-password"
					required
					bind:value={confirmPassword}
					class={inputClass}
					placeholder="再次输入密码"
				/>
			</label>

			{#if mode === "setup" && hasLegacyAdmin}
				<label class="block">
					<span class="block text-sm text-75 mb-1.5">原管理员密码</span>
					<input
						type="password"
						autocomplete="current-password"
						required
						bind:value={legacyPassword}
						class={inputClass}
						placeholder="用于认领旧后台账号"
					/>
					<span class="block text-xs text-50 mt-1.5">
						检测到旧版管理员账号，需验证原密码以完成认领
					</span>
				</label>
			{/if}

			<Turnstile bind:this={turnstileRef} bind:token={turnstileToken} action="signup" />

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-xl bg-(--primary-fill) px-6 py-3 text-sm font-semibold text-(--primary-on-fill) transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{loading ? "提交中…" : mode === "setup" ? "创建站长账号" : "注 册"}
			</button>
		</form>

		<p class="text-center text-sm text-50 mt-6">
			已有账号？
			<a href="/login/" data-no-swup class="text-(--primary-text) font-medium hover:underline"
				>直接登录</a
			>
		</p>
	{/if}
</div>
