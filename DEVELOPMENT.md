# 多用户系统 · 开发文档

> 本文档是多用户系统开发/重做的唯一参考：已确认的预览设计、已拍板的架构决策、数据模型、实测技术事实、复用原则。

---

## 一、设计定稿（已确认的预览方案）

预览文件在 `design-proposals/admin-plans/`，本地服务 `http://127.0.0.1:8899/admin-plans/` 即可查看。

### 前台页面（定稿：auth.html，交互已实测）

| 页面 | 内容 |
|---|---|
| 登录页 `/login/` | 裸布局居中卡片（max-width 26rem）：圆底图标 + 「欢迎回来 👋」+ 邮箱/密码 + 记住我 + 忘记密码 + 登录按钮 + OAuth 分隔区（GitHub/Google，未配凭据不渲染）+ 注册链接 |
| 注册页 `/register/` | 昵称(≤30)/邮箱/密码/确认密码；校验规则 8~128 位、两次一致；成功后进「邮箱验证」落地态 |
| 邮箱验证 | 链接落地 → ✅自动登录；失效 → 重发入口（3 次/时） |
| 忘记密码 | 邮箱表单 → 「已发送至 xxx」→ 链接 1h 有效 → 重置后自动登录 |
| 个人中心 `/profile/` | 资料（昵称/头像/简介）+ 改密 + **别名邮箱增删**（下游半成品补全）+ 我的权限 |

### 后台页面（交互定稿：demo.html）

| 页面 | 交互（已实测可用） |
|---|---|
| 用户管理 | 搜索(防抖) + 表格：用户/邮箱/别名/验证徽标/角色/评论数/操作（封禁⇄解封、重发验证）；admin 不可封禁 |
| 评论审核 | tab 计数（待审/已通过/垃圾/已删除）+ 表格四列：作者(徽标)/内容(正文+目标副行)/时间/操作（通过\|垃圾\|删除，软删可恢复）；「全部通过」仅待审显示 |
| 权限审批 | 表格：申请人/权限点/备注/状态/操作（批准\|拒绝\|撤销）；权限点目录 post:create |

## 二、架构决策（已拍板）

1. **直接复用下游**：后台管理页面、原生评论组件等**直接融合替换使用下游的实现**，改造成适配本项目（接口、主题 token、.ui-* 布局），不自研、不保留本项目旧版对应物。
2. **统一会话**：全站只有一套登录/注册（前台 /login /register）；后台无独立登录页，未登录访问 /admin/ 重定向 `/login/?next=/admin/`；会话 cookie 按角色区分时长（admin 4h + 密码指纹吊销 / 用户 30 天）。
3. **数据库单基线**：所有新表写进 `migrations/0001_init.sql`（幂等），不新增迁移文件；线上 `wrangler d1 execute --remote` 重放同步。
4. **补全下游半成品**：密码重置、别名邮箱管理 API、mail_log 表（下游有设计无实现/漏建表，全部补全）。
5. **OAuth/Turnstile 代码带上**：未配置凭据时自动隐藏/跳过，不影响默认行为。
6. **评论动作映射**：前端发状态值（approved/deleted），API 归一为动词（approve/delete）。

## 三、数据模型（9 张表，幂等写入 0001）

| 表 | 要点 |
|---|---|
| users | id UUID/email 唯一小写/email_verified/name≤30/password bcrypt $2b$10/avatar/bio/role('user'，admin 行由迁移产生)/banned |
| oauth_accounts | user_id FK/provider CHECK(github,google)/provider_user_id，UNIQUE 双列 |
| email_verifications | token_hash sha256/purpose(signup 24h，reset 1h)/used_at 防重放 |
| user_emails | user_id FK/email 唯一/verified（别名邮箱） |
| user_permissions | (user_id,perm) PK/granted_by/granted_at |
| permission_requests | user_id/perm/status CHECK(pending approved denied)/note≤200/reviewed_by |
| comments | target ≤200 不设 FK/parent_id 仅一级回复/user_id ON DELETE SET NULL/guest_name 匿名必填/content≤2000/status(pending approved spam deleted 软删)/ip + 双复合索引 |
| post_likes | (post_slug,user_id) PK 天然防重 |
| mail_log | from/to/status/error（下游漏建，补全） |

**管理员迁移段**（0001 末尾，幂等）：旧 admin_users 行迁入 users（role='admin'）后 `DROP TABLE admin_users`。管理员邮箱占位 `username@local`，重做时用户可指定真实邮箱。

## 四、实测技术事实（开发直接引用）

1. **邮件**：worker-mailer 直连 QQ SMTP 实测成功（smtp.qq.com:465，授权码，from=登录邮箱）；`cloudflare:sockets` 支持 465/587（25 封锁）；nodemailer 不可用；CF 原生 send_email 绑定需付费计划。provider 抽象：none（正文打印日志=本地获取验证链接的方式）/smtp/brevo 预留。
2. **缓存约束**：HTML 全页缓存 180s——登录态/点赞状态/我的评论必须客户端拉取，禁止烘进缓存 HTML；middleware 需绕过带会话 cookie 的请求与 auth 页（防跨用户串号）。
3. **API 规范**：`trailingSlash:"always"`——fetch 一律带尾斜杠；写 API Origin 同源校验；限流复用 rate_limits 表（注册 3/时、登录 8/15分、评论匿名 3条/10分 登录 20条/10分、点赞 60/分）。
4. **本地 D1**：删 `.wrangler/state/v3/d1/` 重建即全量引导；含 FK 新表的测试夹具必须先插 users 行。
5. **图标**：astro-icon 离线集合无 material-symbols:shield（有 admin-panel-settings/shield-lock）；后台侧栏图标走 adminNav.ts 内联 SVG。
6. **构建**：build 后必须重启 wrangler preview（资产清单缓存）；wrangler 本地 workerd 兼容日期上限 2026-09-02。

## 五、开发流程规则

1. 开工前：本方案交用户确认（或按用户新指令修订）后执行。
2. 执行中遇到本方案未覆盖的岔口，停下来问，不自行决定。
3. 完成后统一验证：全链 check/build/vitest + 无头浏览器全流程实测截图（注册→验证→登录→评论→点赞→审核→邮件）。
