<script lang="ts">
import { onDestroy, onMount, untrack } from "svelte";

interface Props {
	slug: string;
	initialCount?: number;
	initialLiked?: boolean;
}

let { slug, initialCount = 0, initialLiked = false }: Props = $props();

let count = $state(untrack(() => initialCount));
let liked = $state(untrack(() => initialLiked));
let authenticated = $state(false);
let authChecked = $state(false);
let busy = $state(false);
let hint = $state("");
let hintTimer: ReturnType<typeof setTimeout> | undefined;

// GET 与首次点击的竞态：POST 一开始就作废在途的状态拉取，避免后到的旧响应覆盖点赞结果
let loadTicket = 0;

onMount(() => {
	(async () => {
		const ticket = ++loadTicket;
		try {
			const resp = await fetch(`/api/likes/?slug=${encodeURIComponent(slug)}`, {
				credentials: "same-origin",
			});
			if (!resp.ok) return;
			const data = (await resp.json()) as {
				count?: number;
				liked?: boolean;
				authenticated?: boolean;
			};
			if (ticket !== loadTicket) return;
			if (typeof data.count === "number") count = data.count;
			if (typeof data.liked === "boolean") liked = data.liked;
			if (typeof data.authenticated === "boolean") {
				authenticated = data.authenticated;
				authChecked = true;
			}
		} catch {
			// 计数只是装饰，失败时保持 SSR 种子值
		}
	})();
});

onDestroy(() => {
	if (hintTimer) clearTimeout(hintTimer);
});

function showHint(text: string) {
	hint = text;
	if (hintTimer) clearTimeout(hintTimer);
	hintTimer = setTimeout(() => {
		hint = "";
	}, 2200);
}

function goLogin() {
	const next = window.location.pathname + window.location.search;
	window.location.href = `/login/?next=${encodeURIComponent(next)}`;
}

async function toggle() {
	if (busy) return;

	// 已确认未登录就直接跳转；未知（首次 GET 失败）则交给 POST 的 401 判定
	if (authChecked && !authenticated) {
		showHint("请先登录");
		setTimeout(goLogin, 600);
		return;
	}

	busy = true;
	loadTicket += 1;
	try {
		const resp = await fetch("/api/likes/", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug }),
		});
		const data = (await resp.json().catch(() => null)) as {
			message?: string;
			count?: number;
			liked?: boolean;
			needLogin?: boolean;
		} | null;

		if (resp.status === 401 || data?.needLogin) {
			authenticated = false;
			authChecked = true;
			showHint("请先登录");
			setTimeout(goLogin, 600);
			return;
		}

		if (resp.status === 403 && (data as { needVerify?: boolean })?.needVerify) {
			showHint("请先完成邮箱验证");
			return;
		}

		if (!resp.ok) {
			showHint(data?.message || "操作失败，请稍后再试");
			return;
		}

		if (typeof data?.count === "number") count = data.count;
		if (typeof data?.liked === "boolean") liked = data.liked;
		showHint(liked ? "已赞" : "已取消");
	} catch {
		showHint("网络错误，请稍后再试");
	} finally {
		busy = false;
	}
}
</script>

<div class="flex items-center gap-3">
  <button
    type="button"
    onclick={toggle}
    disabled={busy}
    aria-pressed={liked}
    aria-label={liked ? "取消点赞" : "点赞本文"}
    class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 active:scale-95 disabled:opacity-60 {liked
      ? 'border-(--primary-fill) bg-(--primary-fill) text-(--primary-on-fill)'
      : 'border-(--line-divider) text-50 hover:border-(--primary) hover:text-(--primary-text)'}"
  >
    <svg
      viewBox="0 0 24 24"
      class="h-4 w-4"
      aria-hidden="true"
      fill={liked ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width={liked ? 0 : 2}
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      />
    </svg>
    <span class="font-medium tabular-nums">{count}</span>
    <span>{liked ? "已赞" : "点赞"}</span>
  </button>

  {#if hint}
    <span class="text-50 text-xs" role="status">{hint}</span>
  {/if}
</div>
