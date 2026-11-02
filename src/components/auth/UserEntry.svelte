<script lang="ts">
import { onMount } from "svelte";

interface Me {
	id: string;
	name: string;
	avatar: string;
	role: string;
}

let me = $state<Me | null>(null);
let canAccess = $state(false);
let ready = $state(false);
let open = $state(false);
let root: HTMLDivElement | undefined = $state();

const nextPath = () =>
	typeof window === "undefined"
		? "/"
		: `${window.location.pathname}${window.location.search}`;

onMount(() => {
	(async () => {
		try {
			const resp = await fetch("/api/auth/me/", {
				credentials: "same-origin",
			});
			if (resp.ok) {
				const data = (await resp.json()) as {
					authenticated?: boolean;
					user?: Me | null;
					canAccess?: boolean;
				};
				me = data.authenticated ? (data.user ?? null) : null;
				canAccess = Boolean(data.canAccess);
			}
		} catch {
			// 未登录按匿名渲染
		} finally {
			ready = true;
		}
	})();

	const onClick = (e: MouseEvent) => {
		if (!root) return;
		if (!root.contains(e.target as Node)) open = false;
	};
	const onKey = (e: KeyboardEvent) => {
		if (e.key === "Escape") open = false;
	};
	document.addEventListener("click", onClick);
	document.addEventListener("keydown", onKey);
	return () => {
		document.removeEventListener("click", onClick);
		document.removeEventListener("keydown", onKey);
	};
});

async function logout() {
	open = false;
	try {
		await fetch("/api/auth/logout/", {
			method: "POST",
			credentials: "same-origin",
		});
	} catch {
		// 忽略：无论如何刷新回匿名态
	}
	window.location.reload();
}
</script>

<div class="relative" bind:this={root}>
	{#if !ready}
		<span class="inline-block h-[44px] w-[44px]"></span>
	{:else if !me}
		<a
			href={`/login/?next=${encodeURIComponent(nextPath())}`}
			class="btn-plain scale-animation inline-flex h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm active:scale-90"
			aria-label="登录或注册"
		>
			登录 / 注册
		</a>
	{:else}
		<button
			type="button"
			class="btn-plain scale-animation flex h-[44px] w-[44px] items-center justify-center rounded-lg active:scale-90"
			aria-label="账号菜单"
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			{#if me.avatar}
				<img
					src={me.avatar}
					alt=""
					class="h-7 w-7 rounded-full object-cover"
					loading="lazy"
				/>
			{:else}
				<span
					class="flex h-7 w-7 items-center justify-center rounded-full bg-(--primary) text-xs font-bold text-(--primary-on-fill)"
				>
					{me.name.slice(0, 1).toUpperCase()}
				</span>
			{/if}
		</button>

		{#if open}
			<div
				class="float-panel absolute right-0 top-[52px] z-50 w-44 rounded-xl p-1.5"
			>
				<div class="px-3 py-2 text-xs text-(--content-meta) truncate">
					{me.name}
				</div>
				<a
					href="/profile/"
					class="block rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
				>个人中心</a>
				{#if canAccess}
					<a
						href="/admin/"
						class="block rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
					>{me.role === "admin" ? "后台管理" : "控制台"}</a>
				{/if}
				<button
					type="button"
					class="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
					onclick={logout}
				>退出登录</button>
			</div>
		{/if}
	{/if}
</div>
