<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

// 后台审核对接 GET /api/comments/admin/ 与 POST /api/comments/moderate/
// 状态值即状态机的四个格子；动作是动词（approve/spam/delete），软删可恢复

type CommentItem = {
	id: string;
	target: string;
	parentId: string | null;
	content: string;
	status: string;
	guestName: string;
	guestEmail: string;
	ip: string;
	createdAt: string;
	authorName: string;
	isMember: boolean;
};

type ListResult = {
	items?: CommentItem[];
	total?: number;
	page?: number;
	pageSize?: number;
};

const TABS = [
	{ value: "pending", label: "待审核" },
	{ value: "approved", label: "已通过" },
	{ value: "spam", label: "垃圾" },
	{ value: "deleted", label: "已删除" },
] as const;

const PAGE_SIZE = 20;

let status = $state<string>("pending");
let items = $state<CommentItem[]>([]);
let total = $state(0);
let page = $state(1);
let counts = $state<Record<string, number>>({});
let loading = $state(true);
let error = $state("");
let busyId = $state("");
let bulkBusy = $state(false);

const totalPages = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));

async function load(nextPage = page) {
	loading = true;
	error = "";
	try {
		const data = await apiJson<ListResult>(
			`/api/comments/admin/?status=${encodeURIComponent(status)}&page=${nextPage}&pageSize=${PAGE_SIZE}`,
		);
		items = data.items ?? [];
		total = data.total ?? 0;
		page = data.page ?? nextPage;
		counts = { ...counts, [status]: total };
	} catch (e) {
		error = e instanceof Error ? e.message : "加载失败";
		items = [];
	}
	loading = false;
}

// 四个 tab 的计数各自只有 total 可信：pageSize=1 的轻量探测，不额外加接口契约
async function loadCounts() {
	const entries = await Promise.all(
		TABS.map(async (tab) => {
			try {
				const data = await apiJson<ListResult>(
					`/api/comments/admin/?status=${tab.value}&page=1&pageSize=1`,
				);
				return [tab.value, data.total ?? 0] as const;
			} catch {
				return [tab.value, 0] as const;
			}
		}),
	);
	counts = Object.fromEntries(entries);
}

function switchStatus(next: string) {
	if (status === next) return;
	status = next;
	page = 1;
	void load(1);
}

async function act(id: string, action: "approve" | "spam" | "delete") {
	if (busyId) return;
	busyId = id;
	try {
		await apiJson("/api/comments/moderate/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, action }),
		});
		items = items.filter((c) => c.id !== id);
		total = Math.max(0, total - 1);
		counts = { ...counts, [status]: total };
		void loadCounts();
	} catch (e) {
		error = e instanceof Error ? e.message : "操作失败";
	}
	busyId = "";
}

async function approveAll() {
	if (bulkBusy || !items.length) return;
	bulkBusy = true;
	error = "";
	try {
		await apiJson("/api/comments/moderate/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ids: items.map((c) => c.id), action: "approve" }),
		});
		await load(page);
		void loadCounts();
	} catch (e) {
		error = e instanceof Error ? e.message : "批量操作失败";
	}
	bulkBusy = false;
}

function badgeOf(comment: CommentItem): { label: string; warn: boolean } {
	return comment.isMember
		? { label: "注册", warn: false }
		: { label: "匿名", warn: true };
}

function formatTime(raw: string): string {
	if (!raw) return "";
	const iso = /Z|[+-]\d{2}:\d{2}$/.test(raw)
		? raw
		: `${raw.replace(" ", "T")}Z`;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return raw;
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMount(() => {
	void loadCounts();
	void load(1);
});
</script>

<div class="ui-page">
  <div class="ui-head">
    <div>
      <h2 class="ui-title">评论审核</h2>
      <p class="ui-sub">登录用户评论自动通过（在「已通过」查看）；匿名评论进入「待审核」；删除为软删可追溯</p>
    </div>
    <div class="ui-acts">
      {#each TABS as tab (tab.value)}
        <button
          class="ui-btn ui-btn-sm"
          class:ui-btn-primary={status === tab.value}
          onclick={() => switchStatus(tab.value)}
        >
          {tab.label}
          <span class="ui-badge">{counts[tab.value] ?? 0}</span>
        </button>
      {/each}
      <button class="ui-btn ui-btn-sm ui-btn-ghost" onclick={() => { void loadCounts(); void load(page); }}>
        刷新
      </button>
      {#if status === "pending" && items.length > 0}
        <button class="ui-btn ui-btn-sm ui-btn-primary" disabled={bulkBusy} onclick={approveAll}>
          {bulkBusy ? "处理中…" : "全部通过"}
        </button>
      {/if}
    </div>
  </div>

  <div class="ui-card">
    {#if loading}
      <div class="ui-empty">加载中…</div>
    {:else if error}
      <div class="ui-empty">{error}</div>
    {:else if items.length === 0}
      <div class="ui-empty">该状态下暂无评论</div>
    {:else}
      <table class="ui-table">
        <thead>
          <tr>
            <th>作者</th>
            <th>评论内容</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {#each items as comment (comment.id)}
            <tr>
              <td>
                <div class="flex flex-wrap items-center gap-2">
                  <span>{comment.authorName}</span>
                  <span class="ui-badge" class:ui-badge-warn={badgeOf(comment).warn}>
                    {badgeOf(comment).label}
                  </span>
                </div>
                {#if comment.guestEmail || comment.ip}
                  <div class="ui-sub">{comment.guestEmail || "—"} · IP {comment.ip || "—"}</div>
                {/if}
              </td>
              <td>
                <div class="whitespace-pre-wrap break-words">{comment.content}</div>
                <div class="ui-sub">
                  目标：{comment.target}{comment.parentId ? " · 回复" : ""}
                </div>
              </td>
              <td class="ui-sub">{formatTime(comment.createdAt)}</td>
              <td>
                <div class="flex flex-wrap items-center gap-2">
                  {#if status === "pending"}
                    <button
                      class="ui-btn ui-btn-sm ui-btn-primary"
                      disabled={busyId === comment.id}
                      onclick={() => act(comment.id, "approve")}
                    >
                      通过
                    </button>
                    <button
                      class="ui-btn ui-btn-sm"
                      disabled={busyId === comment.id}
                      onclick={() => act(comment.id, "spam")}
                    >
                      垃圾
                    </button>
                    <button
                      class="ui-btn ui-btn-sm"
                      disabled={busyId === comment.id}
                      onclick={() => act(comment.id, "delete")}
                    >
                      删除
                    </button>
                  {:else if status === "approved"}
                    <button
                      class="ui-btn ui-btn-sm"
                      disabled={busyId === comment.id}
                      onclick={() => act(comment.id, "delete")}
                    >
                      删除
                    </button>
                  {:else}
                    <button
                      class="ui-btn ui-btn-sm ui-btn-primary"
                      disabled={busyId === comment.id}
                      onclick={() => act(comment.id, "approve")}
                    >
                      恢复
                    </button>
                    {#if status === "spam"}
                      <button
                        class="ui-btn ui-btn-sm"
                        disabled={busyId === comment.id}
                        onclick={() => act(comment.id, "delete")}
                      >
                        删除
                      </button>
                    {/if}
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if totalPages > 1}
    <div class="ui-acts">
      <button class="ui-btn ui-btn-sm" disabled={page <= 1 || loading} onclick={() => load(page - 1)}>
        上一页
      </button>
      <span class="ui-sub">{page} / {totalPages}</span>
      <button
        class="ui-btn ui-btn-sm"
        disabled={page >= totalPages || loading}
        onclick={() => load(page + 1)}
      >
        下一页
      </button>
    </div>
  {/if}
</div>
