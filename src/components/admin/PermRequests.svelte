<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

// 后台「权限审批」：申请列表 → 批准/拒绝/撤销
// 列表 GET /api/admin/perm-requests/?status=&page=&pageSize=
// 审批 POST /api/admin/perm-review/ { id, action: approve|deny }
// 撤销 POST /api/perms/revoke/ { userId, perm }（只删 user_permissions，不动申请记录）

interface ReqView {
	id: string;
	user_id: string;
	perm: string;
	permLabel: string;
	status: string;
	note: string;
	requested_at: string;
	reviewed_at: string | null;
	reviewed_by: string | null;
	userName: string;
	userEmail: string;
	granted: boolean;
}

type ListResult = {
	items?: ReqView[];
	total?: number;
	page?: number;
	pageSize?: number;
};

const TABS = [
	{ value: "pending", label: "待审批" },
	{ value: "approved", label: "已通过" },
	{ value: "denied", label: "已拒绝" },
	{ value: "all", label: "全部" },
] as const;

const PAGE_SIZE = 20;

let status = $state<string>("pending");
let items = $state<ReqView[]>([]);
let total = $state(0);
let page = $state(1);
let loading = $state(true);
let error = $state("");
let actionError = $state("");
let toast = $state("");
let busyKey = $state("");

const totalPages = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));

async function load(nextPage = page) {
	loading = true;
	error = "";
	try {
		const data = await apiJson<ListResult>(
			`/api/admin/perm-requests/?status=${encodeURIComponent(status)}&page=${nextPage}&pageSize=${PAGE_SIZE}`,
		);
		items = data.items ?? [];
		total = data.total ?? 0;
		page = data.page ?? nextPage;
	} catch (e) {
		error = e instanceof Error ? e.message : "加载失败";
		items = [];
	} finally {
		loading = false;
	}
}

function switchStatus(next: string) {
	if (status === next) return;
	status = next;
	page = 1;
	void load(1);
}

function flash(message: string) {
	toast = message;
	setTimeout(() => {
		if (toast === message) toast = "";
	}, 2400);
}

async function review(id: string, action: "approve" | "deny") {
	if (busyKey) return;
	busyKey = `review:${id}`;
	actionError = "";
	try {
		await apiJson("/api/admin/perm-review/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, action }),
		});
		flash(action === "approve" ? "已批准，权限已授予" : "已拒绝");
		await load();
	} catch (e) {
		actionError = e instanceof Error ? e.message : "操作失败";
	} finally {
		busyKey = "";
	}
}

async function revoke(item: ReqView) {
	if (busyKey) return;
	if (
		!confirm(`确定撤销「${item.permLabel}」？撤销后该用户将失去对应后台权限。`)
	)
		return;
	busyKey = `revoke:${item.id}`;
	actionError = "";
	try {
		await apiJson("/api/perms/revoke/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId: item.user_id, perm: item.perm }),
		});
		flash("已撤销授权");
		await load();
	} catch (e) {
		actionError = e instanceof Error ? e.message : "撤销失败";
	} finally {
		busyKey = "";
	}
}

function statusOf(item: ReqView): { label: string; warn: boolean } {
	if (item.status === "pending") return { label: "待审", warn: true };
	if (item.status === "approved")
		return item.granted
			? { label: "已批准", warn: false }
			: { label: "已撤销", warn: true };
	return { label: "已拒绝", warn: true };
}

onMount(() => {
	void load(1);
});
</script>

<div class="ui-page">
  <div class="ui-head">
    <div>
      <h2 class="ui-title">权限审批</h2>
      <p class="ui-sub">权限点目录：post:create（投稿）；管理员天然拥有全部权限</p>
    </div>
    <div class="ui-acts">
      {#each TABS as tab (tab.value)}
        <button
          class="ui-btn ui-btn-sm"
          class:ui-btn-primary={status === tab.value}
          onclick={() => switchStatus(tab.value)}
        >
          {tab.label}
        </button>
      {/each}
      <button class="ui-btn ui-btn-sm ui-btn-ghost" onclick={() => { void load(page); }}>
        刷新
      </button>
    </div>
  </div>

  {#if toast}<p class="ui-sub flash">{toast}</p>{/if}
  {#if actionError}<p class="ui-sub flash-err">{actionError}</p>{/if}

  <div class="ui-card">
    {#if loading}
      <div class="ui-empty">加载中…</div>
    {:else if error}
      <div class="ui-empty">{error}</div>
    {:else if items.length === 0}
      <div class="ui-empty">暂无申请</div>
    {:else}
      <div class="table-wrap">
        <table class="ui-table">
        <thead>
          <tr>
            <th>申请人</th>
            <th>权限点</th>
            <th>备注</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {#each items as item (item.id)}
            <tr>
              <td>
                <div>{item.userName || "（无昵称）"}</div>
                <div class="ui-sub">{item.userEmail || "—"}</div>
              </td>
              <td>
                <div>{item.permLabel}</div>
                <div class="ui-sub mono">{item.perm}</div>
              </td>
              <td>
                {#if item.note}
                  <div class="note">{item.note}</div>
                {:else}
                  <span class="ui-sub">—</span>
                {/if}
                <div class="ui-sub">{item.requested_at}</div>
              </td>
              <td>
                <span class="ui-badge" class:ui-badge-warn={statusOf(item).warn}>
                  {statusOf(item).label}
                </span>
              </td>
              <td>
                <div class="row-acts">
                  {#if item.status === "pending"}
                    <button
                      class="ui-btn ui-btn-sm ui-btn-primary"
                      disabled={busyKey === `review:${item.id}`}
                      onclick={() => review(item.id, "approve")}
                    >
                      批准
                    </button>
                    <button
                      class="ui-btn ui-btn-sm"
                      disabled={busyKey === `review:${item.id}`}
                      onclick={() => review(item.id, "deny")}
                    >
                      拒绝
                    </button>
                  {:else if item.status === "approved" && item.granted}
                    <button
                      class="ui-btn ui-btn-sm"
                      disabled={busyKey === `revoke:${item.id}`}
                      onclick={() => revoke(item)}
                    >
                      撤销
                    </button>
                  {:else}
                    <span class="ui-sub">—</span>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
        </table>
      </div>
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

<style>
  .table-wrap {
    overflow-x: auto;
  }
  .row-acts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .note {
    max-width: 32rem;
    word-break: break-word;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .flash {
    margin: 0 0 10px;
    color: var(--primary-text);
  }
  .flash-err {
    margin: 0 0 10px;
    color: var(--warning);
  }
</style>
