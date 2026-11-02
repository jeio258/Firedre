<script lang="ts">
// 个人资料卡片：资料编辑 / 邮箱验证状态与重发 / 修改密码 / 退出登录
// 数据由 profile.astro SSR 注入（未登录不会渲染本组件）

export interface ProfileUser {
	id: string;
	email: string;
	emails?: string[];
	emailVerified: boolean;
	name: string;
	avatar: string;
	bio: string;
	role: string;
	createdAt: string;
}

interface Props {
	user: ProfileUser;
	verified?: boolean; // 刚从验证链接落地
}

let { user, verified = false }: Props = $props();

// 三个字段取 SSR 初始值作表单初值，之后由用户编辑，无需随 user 变化响应
// svelte-ignore state_referenced_locally
let name = $state(user.name);
// svelte-ignore state_referenced_locally
let avatar = $state(user.avatar);
// svelte-ignore state_referenced_locally
let bio = $state(user.bio);

let saving = $state(false);
let saveMsg = $state("");
let saveErr = $state("");

let curPw = $state("");
let newPw = $state("");
let confirmPw = $state("");
let pwSaving = $state(false);
let pwMsg = $state("");
let pwErr = $state("");

let resendLoading = $state(false);
let resendMsg = $state("");
let logoutLoading = $state(false);

const verifiedFlash = $derived(verified && user.emailVerified);

async function saveProfile(event: Event) {
	event.preventDefault();
	saving = true;
	saveMsg = "";
	saveErr = "";
	try {
		const resp = await fetch("/api/auth/profile/", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: name.trim(),
				avatar: avatar.trim(),
				bio: bio.trim(),
			}),
		});
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok || !data.ok) {
			saveErr = data.message || "保存失败";
			return;
		}
		saveMsg = "资料已保存";
		if (data.user) {
			name = data.user.name;
			avatar = data.user.avatar;
			bio = data.user.bio;
		}
	} catch {
		saveErr = "网络错误，请重试";
	} finally {
		saving = false;
	}
}

async function changePassword(event: Event) {
	event.preventDefault();
	pwMsg = "";
	pwErr = "";
	if (newPw !== confirmPw) {
		pwErr = "两次输入的新密码不一致";
		return;
	}
	pwSaving = true;
	try {
		const resp = await fetch("/api/auth/password/", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
		});
		const data = await resp.json().catch(() => ({}));
		if (!resp.ok || !data.ok) {
			pwErr = data.message || "修改失败";
			return;
		}
		pwMsg = "密码已更新";
		curPw = "";
		newPw = "";
		confirmPw = "";
	} catch {
		pwErr = "网络错误，请重试";
	} finally {
		pwSaving = false;
	}
}

async function resendVerify() {
	if (resendLoading) return;
	resendMsg = "";
	resendLoading = true;
	try {
		const resp = await fetch("/api/auth/resend/", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: user.email }),
		});
		const data = await resp.json().catch(() => ({}));
		resendMsg =
			data.message ||
			(resp.ok ? "验证邮件已发送，请查收。" : "发送失败，请稍后再试");
	} catch {
		resendMsg = "网络错误，请重试";
	} finally {
		resendLoading = false;
	}
}

async function logout() {
	if (logoutLoading) return;
	logoutLoading = true;
	try {
		await fetch("/api/auth/logout/", {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		});
	} finally {
		window.location.href = "/";
	}
}
</script>

<div class="w-full max-w-2xl mx-auto space-y-4">
	<!-- 账号概览 -->
	<div class="card-base px-7 py-6 rounded-(--radius-large)">
		<div class="flex items-center gap-4">
			{#if avatar}
				<img src={avatar} alt={name} class="w-16 h-16 rounded-full object-cover border border-(--line-divider)" />
			{:else}
				<div class="w-16 h-16 rounded-full bg-(--primary)/10 flex items-center justify-center text-(--primary) text-2xl font-bold">
					{(name || "?").slice(0, 1)}
				</div>
			{/if}
			<div class="min-w-0">
				<h2 class="text-lg font-bold text-90 truncate">{name}</h2>
				{#each user.emails || [user.email] as mail (mail)}
					<p class="text-sm text-50 truncate">{mail}</p>
				{/each}
				<div class="mt-1.5 flex items-center gap-2 flex-wrap">
					{#if user.emailVerified}
						<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30">
							✓ 邮箱已验证
						</span>
					{:else}
						<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
							! 邮箱未验证
						</span>
					{/if}
					<span class="text-xs px-2 py-0.5 rounded-full bg-(--primary)/10 text-(--primary) border border-(--primary)/30">
						{user.role === "admin" ? "管理员" : "普通用户"}
					</span>
				</div>
			</div>
		</div>

		{#if verifiedFlash}
			<p class="mt-4 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-2.5 text-sm text-green-600 dark:text-green-400">
				邮箱验证成功！现在你可以完整参与评论与互动了。
			</p>
		{/if}

		{#if !user.emailVerified}
			<div class="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3">
				<p class="text-sm text-amber-700 dark:text-amber-400">
					邮箱尚未验证，验证后才能评论、点赞。
				</p>
				{#if resendMsg}
					<p class="text-sm text-75 mt-2">{resendMsg}</p>
				{/if}
				<button
					type="button"
					onclick={resendVerify}
					disabled={resendLoading}
					class="mt-2 text-sm font-medium text-(--primary) hover:underline disabled:opacity-60"
				>
					{resendLoading ? "发送中…" : "重新发送验证邮件"}
				</button>
			</div>
		{/if}
	</div>

	<!-- 资料编辑 -->
	<form onsubmit={saveProfile} class="card-base px-7 py-6 rounded-(--radius-large)">
		<h3 class="text-base font-bold text-90 mb-4">个人资料</h3>

		{#if saveMsg}
			<p class="mb-3 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-2 text-sm text-green-600 dark:text-green-400">{saveMsg}</p>
		{/if}
		{#if saveErr}
			<p class="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{saveErr}</p>
		{/if}

		<div class="space-y-4">
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">昵称</span>
				<input
					type="text"
					maxlength="30"
					required
					bind:value={name}
					class="w-full px-4 py-2.5 text-[15px] bg-transparent border border-black/10 dark:border-white/10 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-(--primary) focus:border-(--primary)"
				/>
			</label>
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">头像地址（站内路径或 https 链接）</span>
				<input
					type="text"
					maxlength="500"
					bind:value={avatar}
					placeholder="/avatar.png"
					class="w-full px-4 py-2.5 text-[15px] bg-transparent border border-black/10 dark:border-white/10 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-(--primary) focus:border-(--primary)"
				/>
			</label>
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">个人简介（最多 500 字）</span>
				<textarea
					rows="3"
					maxlength="500"
					bind:value={bio}
					class="w-full px-4 py-2.5 text-[15px] bg-transparent border border-black/10 dark:border-white/10 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-(--primary) focus:border-(--primary) resize-y"
				></textarea>
			</label>
		</div>

		<button
			type="submit"
			disabled={saving}
			class="mt-5 rounded-xl bg-(--primary) px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-(--primary)/90 disabled:opacity-60"
		>
			{saving ? "保存中…" : "保存资料"}
		</button>
	</form>

	<!-- 修改密码 -->
	<form onsubmit={changePassword} class="card-base px-7 py-6 rounded-(--radius-large)">
		<h3 class="text-base font-bold text-90 mb-4">修改密码</h3>

		{#if pwMsg}
			<p class="mb-3 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-2 text-sm text-green-600 dark:text-green-400">{pwMsg}</p>
		{/if}
		{#if pwErr}
			<p class="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-600 dark:text-red-400">{pwErr}</p>
		{/if}

		<div class="space-y-4">
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">当前密码</span>
				<input
					type="password"
					autocomplete="current-password"
					required
					bind:value={curPw}
					class="w-full px-4 py-2.5 text-[15px] bg-transparent border border-black/10 dark:border-white/10 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-(--primary) focus:border-(--primary)"
				/>
			</label>
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">新密码（至少 8 位）</span>
				<input
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
					bind:value={newPw}
					class="w-full px-4 py-2.5 text-[15px] bg-transparent border border-black/10 dark:border-white/10 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-(--primary) focus:border-(--primary)"
				/>
			</label>
			<label class="block">
				<span class="block text-sm text-75 mb-1.5">确认新密码</span>
				<input
					type="password"
					autocomplete="new-password"
					required
					bind:value={confirmPw}
					class="w-full px-4 py-2.5 text-[15px] bg-transparent border border-black/10 dark:border-white/10 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-(--primary) focus:border-(--primary)"
				/>
			</label>
		</div>

		<button
			type="submit"
			disabled={pwSaving}
			class="mt-5 rounded-xl bg-(--primary) px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-(--primary)/90 disabled:opacity-60"
		>
			{pwSaving ? "提交中…" : "更新密码"}
		</button>
	</form>

	<!-- 退出 -->
	<div class="card-base px-7 py-5 rounded-(--radius-large) flex items-center justify-between gap-4">
		<div>
			<p class="text-sm font-medium text-90">退出登录</p>
			<p class="text-xs text-50 mt-0.5">退出后需重新登录才能评论</p>
		</div>
		<button
			type="button"
			onclick={logout}
			disabled={logoutLoading}
			class="rounded-xl border border-red-500/40 px-5 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-60"
		>
			{logoutLoading ? "退出中…" : "退出登录"}
		</button>
	</div>
</div>
