<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

// 后台「用户管理」：成员列表 + 搜索（防抖）+ 封禁⇄解封
// 数据源 GET /api/auth/admin-users?page=&pageSize=&q= → { users, total, page, pageSize }
// 动作 POST /api/auth/admin-users { id, action: ban|unban|delete }；管理员账号不可封禁/删除

type UserItem = {
	id: string;
	email: string;
	name: string;
	avatar: string;
	email_verified: number;
	banned: number;
	role: string;
	created_at: string;
	oauth_count: number;
	comment_count: number;
};

type ListResult = {
	users?: UserItem[];
	total?: number;
	page?: number;
	pageSize?: number;
};

const PAGE_SIZE = 20;

let items = $state<UserItem[]>([]);
let total = $state(0);
let page = $state(1);
let q = $state("");
let loading = $state(true);
let error = $state("");
let actionError = $state("");
let busyId = $state("");
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const totalPages = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));

async function load(nextPage = page) {
	loading = true;
	error = "";
	try {
		const keyword = q.trim();
		const suffix = keyword ? `&q=${encodeURIComponent(keyword)}` : "";
		const data = await apiJson<ListResult>(
			`/api/auth/admin-users?page=${nextPage}&pageSize=${PAGE_SIZE}${suffix}`,
		);
		items = data.users ?? [];
		total = data.total ?? 0;
		page = data.page ?? nextPage;
	} catch (e) {
		error = e instanceof Error ? e.message : "加载失败";
		items = [];
	} finally {
		loading = false;
	}
}

// 输入即搜：300ms 内无新输入才发请求，避免每键入一个字打一次接口
function queueSearch() {
	if (searchTimer) clearTimeout(searchTimer);
	searchTimer = setTimeout(() => {
		void load(1);
	}, 300);
}

async function act(id: string, action: "ban" | "unban" | "delete") {
	if (busyId) return;
	if (
		action === "ban" &&
		!confirm("确定封禁该用户？封禁后其将无法登录、评论、点赞。")
	)
		return;
	if (
		action === "delete" &&
		!confirm(
			"确定删除该账号？其点赞/绑定/权限将被清除，其评论将转为匿名保留，且不可恢复。",
		)
	)
		return;
	busyId = id;
	actionError = "";
	try {
		await apiJson("/api/auth/admin-users/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, action }),
		});
		if (action === "delete") {
			items = items.filter((u) => u.id !== id);
			total = Math.max(0, total - 1);
		} else {
			const target = items.find((u) => u.id === id);
			if (target) target.banned = action === "ban" ? 1 : 0;
		}
	} catch (e) {
		actionError = e instanceof Error ? e.message : "操作失败";
	} finally {
		busyId = "";
	}
}

function shortDate(raw: string): string {
	return raw ? raw.slice(0, 10) : "—";
}

onMount(() => {
	void load(1);
	return () => {
		if (searchTimer) clearTimeout(searchTimer);
	};
});
</script>

<div class="ui-page">
  <div class="ui-head">
    <div>
      <h2 class="ui-title">用户管理</h2>
      <p class="ui-sub">共 {total} 个账号 · 第 {page} / {totalPages} 页</p>
    </div>
    <div class="ui-acts">
      <input
        class="ui-input user-q"
        type="search"
        placeholder="搜索邮箱 / 昵称…"
        value={q}
        oninput={(e) => {
          q = e.currentTarget.value;
          queueSearch();
        }}
      />
      <button class="ui-btn ui-btn-sm ui-btn-ghost" onclick={() => { void load(page); }}>
        刷新
      </button>
    </div>
  </div>

  {#if actionError}<p class="ui-sub flash">{actionError}</p>{/if}

  <div class="ui-card">
    {#if loading}
      <div class="ui-empty">加载中…</div>
    {:else if error}
      <div class="ui-empty">{error}</div>
    {:else if items.length === 0}
      <div class="ui-empty">没有找到用户</div>
    {:else}
      <div class="table-wrap">
        <table class="ui-table">
        <thead>
          <tr>
            <th>用户</th>
            <th>邮箱</th>
            <th>验证</th>
            <th>角色</th>
            <th>评论</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {#each items as user (user.id)}
            <tr>
              <td>
                <div class="user-cell">
                  {#if user.avatar}
                    <img class="user-avatar" src={user.avatar} alt="" referrerpolicy="no-referrer" />
                  {:else}
                    <span class="user-avatar user-avatar-empty">{user.name?.slice(0, 1) || "?"}</span>
                  {/if}
                  <span class="user-name">{user.name}</span>
                  {#if user.banned === 1}
                    <span class="ui-badge ui-badge-warn">已封禁</span>
                  {/if}
                </div>
                <div class="ui-sub">注册于 {shortDate(user.created_at)}</div>
              </td>
              <td>
                <span class="mono">{user.email}</span>
                {#if user.oauth_count > 0}
                  <div class="ui-sub">OAuth×{user.oauth_count}</div>
                {/if}
              </td>
              <td>
                {#if user.email_verified === 1}
                  <span class="ui-badge">已验证</span>
                {:else}
                  <span class="ui-badge ui-badge-warn">未验证</span>
                {/if}
              </td>
              <td>
                <span class="ui-badge" class:ui-badge-warn={user.role !== "admin"}>
                  {user.role === "admin" ? "管理员" : "普通用户"}
                </span>
              </td>
              <td>{user.comment_count}</td>
              <td>
                {#if user.role === "admin"}
                  <!-- 管理员被封禁会连解封所需的权限一起失去（banned 每请求校验），服务端同样拒绝 -->
                  <span class="ui-sub">不可封禁</span>
                {:else if user.banned === 1}
                  <button
                    class="ui-btn ui-btn-sm"
                    disabled={busyId === user.id}
                    onclick={() => act(user.id, "unban")}
                  >
                    {busyId === user.id ? "处理中…" : "解除封禁"}
                  </button>
                {:else}
                  <button
                    class="ui-btn ui-btn-sm"
                    disabled={busyId === user.id}
                    onclick={() => act(user.id, "ban")}
                  >
                    {busyId === user.id ? "处理中…" : "封禁"}
                  </button>
                  <button
                    class="ui-btn ui-btn-sm"
                    disabled={busyId === user.id}
                    onclick={() => act(user.id, "delete")}
                  >
                    {busyId === user.id ? "处理中…" : "删除"}
                  </button>
                {/if}
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
  .user-q {
    width: 16rem;
  }
  .flash {
    margin: 0 0 10px;
    color: var(--warning);
  }
  .user-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    object-fit: cover;
    flex: 0 0 auto;
    vertical-align: middle;
  }
  .user-avatar-empty {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--btn-regular-bg);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
  }
  .user-name {
    font-weight: 500;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
  }
</style>
