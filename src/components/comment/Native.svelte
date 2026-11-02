<script lang="ts">
import type {
	CommentListResult,
	PublicComment,
} from "@server/comments/service";
import { onMount } from "svelte";

interface Viewer {
	id: string;
	name: string;
	avatar: string;
	emailVerified: boolean;
}

interface Props {
	target: string;
	initial: CommentListResult;
}

let { target, initial }: Props = $props();

type ApiError = Error & { needVerify?: boolean };

// 首屏种子只用于无脚本场景；挂载后立即按登录态重取，SSR 里不能烘登录态（全页缓存 180s）
// svelte-ignore state_referenced_locally
let items = $state<PublicComment[]>(initial.items ?? []);
// svelte-ignore state_referenced_locally
let total = $state(initial.total ?? 0);
// svelte-ignore state_referenced_locally
let page = $state(initial.page ?? 1);
// svelte-ignore state_referenced_locally
let pageSize = $state(initial.pageSize ?? 10);
let viewer = $state<Viewer | null>(null);
let loading = $state(false);
let submitting = $state(false);
let message = $state<{ kind: "ok" | "err"; text: string } | null>(null);
let loginHref = $state("/login/");

let content = $state("");
let guestName = $state("");
let guestEmail = $state("");
let replyTo = $state<string | null>(null);
let replyContent = $state("");

const totalPages = $derived(
	Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
);

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
	const resp = await fetch(path, {
		credentials: "same-origin",
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
	});
	const data = (await resp.json().catch(() => null)) as
		| (T & { message?: string; needVerify?: boolean })
		| null;
	if (!resp.ok) {
		const err = new Error(data?.message || "请求失败，请稍后再试") as ApiError;
		err.needVerify = Boolean(data?.needVerify);
		throw err;
	}
	return data as T;
}

function formatTime(raw: string): string {
	if (!raw) return "";
	// D1 datetime('now') 为 UTC，补 Z 后按本地时区展示
	const iso = /Z|[+-]\d{2}:\d{2}$/.test(raw)
		? raw
		: `${raw.replace(" ", "T")}Z`;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return raw;
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialOf(name: string): string {
	const text = (name || "?").trim();
	return text ? Array.from(text)[0]!.toUpperCase() : "?";
}

async function loadPage(next: number) {
	loading = true;
	message = null;
	try {
		const data = await apiJson<CommentListResult & { viewer: Viewer | null }>(
			`/api/comments/?target=${encodeURIComponent(target)}&page=${next}&pageSize=${pageSize}`,
		);
		items = data.items ?? [];
		total = data.total ?? 0;
		page = data.page ?? next;
		viewer = data.viewer ?? null;
		replyTo = null;
	} catch (err) {
		message = {
			kind: "err",
			text: err instanceof Error ? err.message : "加载失败",
		};
	} finally {
		loading = false;
	}
}

/** 乐观插入：pending 也先本地展示并带「审核中」标记 */
function insertLocal(comment: PublicComment) {
	if (comment.parentId) {
		const parent = items.find((c) => c.id === comment.parentId);
		if (parent) parent.replies = [...(parent.replies ?? []), comment];
		return;
	}
	items = [comment, ...items];
	total += 1;
	page = 1;
}

function resetForm() {
	content = "";
	replyContent = "";
	replyTo = null;
}

async function submit() {
	if (submitting) return;
	message = null;

	const text = (replyTo ? replyContent : content).trim();
	if (!text) {
		message = { kind: "err", text: "评论内容不能为空" };
		return;
	}
	if (!viewer && !guestName.trim()) {
		message = { kind: "err", text: "请填写昵称" };
		return;
	}

	submitting = true;
	try {
		const data = await apiJson<{
			status: "approved" | "pending";
			comment: PublicComment;
		}>("/api/comments/", {
			method: "POST",
			body: JSON.stringify({
				target,
				content: text,
				guestName: viewer ? undefined : guestName.trim(),
				guestEmail: viewer ? undefined : guestEmail.trim(),
				parentId: replyTo ?? undefined,
			}),
		});

		insertLocal(data.comment);
		resetForm();
		message = {
			kind: "ok",
			text:
				data.status === "approved" ? "评论已发布" : "评论已提交，审核后展示",
		};
	} catch (err) {
		const apiErr = err as ApiError;
		message = {
			kind: "err",
			text: apiErr.needVerify
				? `${apiErr.message}（前往个人资料完成验证）`
				: apiErr.message || "提交失败",
		};
	} finally {
		submitting = false;
	}
}

function startReply(id: string) {
	replyTo = replyTo === id ? null : id;
	replyContent = "";
	message = null;
}

onMount(() => {
	loginHref = `/login/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
	void loadPage(page);
});
</script>

<div class="flex flex-col gap-5">
  <div class="rounded-xl border border-(--line-divider) bg-(--card-bg) p-4">
    <div class="mb-3 flex flex-wrap items-center gap-2 text-sm text-(--content-meta)">
      <span class="inline-block h-4 w-1 rounded-full bg-(--primary)"></span>
      {#if viewer}
        <span>以 <span class="font-semibold text-(--primary-text)">{viewer.name}</span> 的身份发表评论</span>
      {:else}
        <span>匿名评论需审核后展示</span>
        <a href={loginHref} class="text-(--primary-text) underline underline-offset-2">登录后直发</a>
      {/if}
    </div>

    {#if viewer && !viewer.emailVerified}
      <div class="rounded-lg bg-(--btn-regular-bg) px-4 py-3 text-sm text-(--content-meta)">
        你的邮箱尚未验证，验证后即可直接发表评论。
        <a href="/profile/" class="text-(--primary-text) underline underline-offset-2">前往个人资料</a>
      </div>
    {:else}
      <textarea
        class="w-full resize-y rounded-lg border border-(--line-divider) bg-transparent px-3 py-2.5 text-sm leading-relaxed text-(--btn-content) outline-none placeholder:text-(--content-meta) focus:border-(--primary)"
        rows="4"
        aria-label="评论内容"
        placeholder="写下你的评论…"
        bind:value={content}
      ></textarea>

      {#if !viewer}
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <input
            class="w-40 rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-sm text-(--btn-content) outline-none placeholder:text-(--content-meta) focus:border-(--primary)"
            type="text"
            aria-label="昵称"
            placeholder="昵称（必填）"
            maxlength="30"
            bind:value={guestName}
          />
          <input
            class="w-56 rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-sm text-(--btn-content) outline-none placeholder:text-(--content-meta) focus:border-(--primary)"
            type="email"
            aria-label="邮箱（可选）"
            placeholder="邮箱（可选，不公开）"
            maxlength="100"
            bind:value={guestEmail}
          />
        </div>
      {/if}

      <div class="mt-3 flex items-center justify-between gap-3">
        <span class="text-xs text-(--content-meta)">
          {#if viewer}
            你的评论将即时展示。
          {:else}
            昵称必填；邮箱仅用于识别，不会公开。
          {/if}
        </span>
        <button
          class="btn-regular rounded-lg px-5 py-2 text-sm disabled:opacity-50"
          onclick={submit}
          disabled={submitting}
        >
          {submitting ? "提交中…" : "发表评论"}
        </button>
      </div>
    {/if}

    {#if message}
      <p
        class="mt-3 text-sm {message.kind === 'ok' ? 'text-(--success)' : 'text-(--danger)'}"
        role="status"
      >
        {message.text}
      </p>
    {/if}
  </div>

  {#if loading && !items.length}
    <div class="py-8 text-center text-sm text-(--content-meta)">加载中…</div>
  {:else if !items.length}
    <div class="py-10 text-center text-sm text-(--content-meta)">还没有评论，来抢沙发~</div>
  {:else}
    <div class="flex flex-col gap-4">
      {#each items as comment (comment.id)}
        <div class="flex gap-3">
          <div
            class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--btn-regular-bg) text-sm font-semibold text-(--primary-text)"
            aria-hidden="true"
          >
            {#if comment.avatar}
              <img src={comment.avatar} alt="" class="h-full w-full object-cover" loading="lazy" />
            {:else}
              {initialOf(comment.authorName)}
            {/if}
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="font-semibold text-(--btn-content)">{comment.authorName}</span>
              {#if comment.isMember}
                <span class="rounded bg-(--primary-fill) px-1.5 py-0.5 text-[0.65rem] text-(--primary-on-fill)">成员</span>
              {/if}
              {#if comment.status === "pending"}
                <span class="rounded bg-(--btn-regular-bg) px-1.5 py-0.5 text-[0.65rem] text-(--warning)">审核中</span>
              {/if}
              <span class="text-xs text-(--content-meta)">{formatTime(comment.createdAt)}</span>
            </div>

            <p class="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-(--btn-content) opacity-90">
              {comment.content}
            </p>

            <button
              class="mt-1.5 text-xs text-(--content-meta) transition hover:text-(--primary-text)"
              onclick={() => startReply(comment.id)}
            >
              {replyTo === comment.id ? "取消回复" : "回复"}
            </button>

            {#if comment.replies?.length}
              <div class="mt-3 flex flex-col gap-3 border-l-2 border-(--line-divider) pl-4">
                {#each comment.replies as reply (reply.id)}
                  <div class="flex gap-2.5">
                    <div
                      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--btn-regular-bg) text-xs font-semibold text-(--primary-text)"
                      aria-hidden="true"
                    >
                      {#if reply.avatar}
                        <img src={reply.avatar} alt="" class="h-full w-full object-cover" loading="lazy" />
                      {:else}
                        {initialOf(reply.authorName)}
                      {/if}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2 text-sm">
                        <span class="font-semibold text-(--btn-content)">{reply.authorName}</span>
                        {#if reply.isMember}
                          <span class="rounded bg-(--primary-fill) px-1.5 py-0.5 text-[0.65rem] text-(--primary-on-fill)">成员</span>
                        {/if}
                        {#if reply.status === "pending"}
                          <span class="rounded bg-(--btn-regular-bg) px-1.5 py-0.5 text-[0.65rem] text-(--warning)">审核中</span>
                        {/if}
                        <span class="text-xs text-(--content-meta)">{formatTime(reply.createdAt)}</span>
                      </div>
                      <p class="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words text-(--btn-content) opacity-90">
                        {reply.content}
                      </p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            {#if replyTo === comment.id}
              {#if viewer && !viewer.emailVerified}
                <div class="mt-3 rounded-lg bg-(--btn-regular-bg) px-3 py-2 text-xs text-(--content-meta)">
                  邮箱验证后即可回复。
                </div>
              {:else}
                <div class="mt-3 rounded-lg border border-(--line-divider) p-3">
                  <textarea
                    class="w-full resize-y rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-sm leading-relaxed text-(--btn-content) outline-none placeholder:text-(--content-meta) focus:border-(--primary)"
                    rows="3"
                    aria-label="回复内容"
                    placeholder="回复 {comment.authorName}…"
                    bind:value={replyContent}
                  ></textarea>
                  {#if !viewer}
                    <div class="mt-2 flex flex-wrap items-center gap-3">
                      <input
                        class="w-36 rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-sm text-(--btn-content) outline-none placeholder:text-(--content-meta) focus:border-(--primary)"
                        type="text"
                        aria-label="昵称"
                        placeholder="昵称（必填）"
                        maxlength="30"
                        bind:value={guestName}
                      />
                      <input
                        class="w-48 rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-sm text-(--btn-content) outline-none placeholder:text-(--content-meta) focus:border-(--primary)"
                        type="email"
                        aria-label="邮箱（可选）"
                        placeholder="邮箱（可选）"
                        maxlength="100"
                        bind:value={guestEmail}
                      />
                    </div>
                  {/if}
                  <div class="mt-2 flex justify-end gap-2">
                    <button
                      class="rounded-lg px-3 py-1.5 text-xs text-(--content-meta) transition hover:text-(--btn-content)"
                      onclick={() => startReply(comment.id)}
                    >
                      取消
                    </button>
                    <button
                      class="btn-regular rounded-lg px-4 py-1.5 text-xs disabled:opacity-50"
                      onclick={submit}
                      disabled={submitting}
                    >
                      {submitting ? "提交中…" : "回复"}
                    </button>
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if totalPages > 1}
    <div class="flex items-center justify-center gap-3 text-sm">
      <button
        class="rounded-lg border border-(--line-divider) px-3 py-1.5 text-(--content-meta) transition hover:text-(--btn-content) disabled:opacity-40"
        onclick={() => loadPage(page - 1)}
        disabled={page <= 1 || loading}
      >
        上一页
      </button>
      <span class="text-(--content-meta)">{page} / {totalPages}</span>
      <button
        class="rounded-lg border border-(--line-divider) px-3 py-1.5 text-(--content-meta) transition hover:text-(--btn-content) disabled:opacity-40"
        onclick={() => loadPage(page + 1)}
        disabled={page >= totalPages || loading}
      >
        下一页
      </button>
    </div>
  {/if}
</div>
