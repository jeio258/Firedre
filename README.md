# Firedre

> **Firefly 主题（Astro 7 + Svelte 5）的云端动态化版本：D1 / R2 存储 + 完整后台管理**

Firedre 以 [Firefly](https://github.com/CuteLeaf/Firefly) 主题为基底，前台保留原版风格与组件（看板娘 / 音乐 / 樱花 / mermaid / katex 等），并将静态内容升级为**云端动态化**：

- **后台管理**（`/admin/`）：文章 / 相册 / 友链 / 公告 / 动态 / 关于页 / 站点设置
- **站点设置**：配置修改自动保存、前台即时生效（版本号驱动缓存失效）
- **云端存储**：D1（数据）+ R2（文件），页面/API 由 Cloudflare Pages（Workers SSR）承载
- **本地开发开箱即用**：`cf-dev-shim` 自动建本地 D1/R2 并应用迁移

在线地址：https://firedre.994613.xyz

---

## 技术栈

| 层 | 选型 |
|---|---|
| 前端框架 | Astro 7（SSR）+ Svelte 5 |
| 托管 | Cloudflare Pages（Workers SSR，`nodejs_compat`） |
| 数据库 | Cloudflare D1（强一致数据源） |
| 对象存储 | Cloudflare R2（文章 / 封面 / 相册 / 上传文件） |
| 会话 | 自有 HMAC Cookie（HttpOnly / SameSite=Lax / 4h），不依赖 KV |
| 认证 | bcrypt 密码哈希 + 登录限流（D1） |

---

## 快速开始（本地开发）

```bash
pnpm install   # Node >= 22.23（preinstall 强制 pnpm）
pnpm dev       # http://localhost:4321
```

本地开发无需手动建库：`cf-dev-shim` 首次启动自动创建本地 D1（`.wrangler/local-state/local-d1.sqlite`）并按序应用 `migrations/*.sql`；本地 R2 模拟为文件系统目录（`.wrangler/local-state/local-r2/`）。

**后台首次使用**：访问 `/admin/` 会提示尚无管理员，进入 `/admin/setup/` 创建首个管理员（密码以 bcrypt 存储于本地 D1）。

> 说明：本地开发**不自动创建管理员**、也不内置演示数据。如需种子数据请查看 `migrations/`（`0004_social_data.sql`、`0009_site_links_extend.sql` 含部分种子）。

### 质量检查

```bash
pnpm check        # astro check（类型与诊断）
pnpm test         # vitest 单元/集成测试
pnpm build        # 生产构建（输出 dist/）
```

---

## 云端所需资源

部署前需在 Cloudflare 账号创建以下资源并绑定到 Pages 项目。

### 1. D1 数据库

```bash
npx wrangler d1 create firedre-blog
# 将返回的 database_id 填入 wrangler.toml 的 [[d1_databases]]
```

### 2. R2 存储桶

```bash
npx wrangler r2 bucket create firedre-blog
# 名称已写入 wrangler.toml 的 [[r2_buckets]]
```

### 3. Secrets（Pages 项目环境变量-加密）

| 变量 | 说明 |
|---|---|
| `ADMIN_USERNAME` | 后台管理员用户名（首次登录时落库为 D1 权威凭据） |
| `ADMIN_PASSWORD` | **bcrypt 哈希**（可用 `node -e "console.log(require('bcryptjs').hashSync('你的密码',10))"` 生成） |
| `ADMIN_API_TOKEN` | 程序化访问令牌（可选） |
| `SESSION_SECRET` | 会话签名密钥，**≥ 32 字符，必须强随机** |
| `WEBDAV_PASSWORD` | 相册 WebDAV 源密码（若使用） |

> 本项目**不需要 KV**：页面 HTML 缓存使用 `caches.default`（Cache API），会话为自有 Cookie。绑定仅需 `DB`（D1）与 `BUCKET`（R2）。

---

## 部署教程

### 方式一：Git 集成部署（连接仓库，push 自动部署）

在 Cloudflare Dashboard **Workers & Pages → Create → Connect to Git** 选择本仓库，然后在项目 **Settings → Build configurations** 配置：

| 项 | 值 |
|---|---|
| Production branch | `main` |
| Build command | `pnpm install && pnpm build` |
| Build output directory | `dist` |
| Root directory | `/` |

> ⚠️ **常见失败**：构建命令是 **Dashboard/项目级配置**，`wrangler.toml` 无法承载它（只声明 `pages_build_output_dir = "dist"` 与绑定）。若连接仓库后部署报 `No build command specified` / `Output directory "dist" not found`，就是在 Dashboard 漏配了 Build command。

连接后还需在 **Settings → Bindings** 绑定资源：

- **D1**：`firedre-blog` → binding `DB`
- **R2**：`firedre-blog` → binding `BUCKET`

并在 **Settings → Environment variables** 添加上节 Secrets。最后执行生产迁移与初始化：

```bash
pnpm d1:migrate          # 对远程 D1 应用 migrations/*.sql
```

### 方式二：Wrangler 直传（CI / 命令行）

适合已有构建产物、不依赖 GitHub 集成的场景：

```bash
pnpm build               # 构建到 dist/
pnpm deploy              # wrangler pages deploy dist --project-name firedre
```

`wrangler.toml` 中的 `pages_build_output_dir` 与 D1/R2 绑定会被 wrangler 读取（需先 `npx wrangler login` 到对应账号）。

### 绑定与配置核对

- 绑定名必须为 `DB` 与 `BUCKET`（代码通过 `env.DB` / `env.BUCKET` 直接引用）
- `SESSION_SECRET` 缺失时登录会被拒绝（不允许弱凭据降级）

---

## 数据表概览

D1 数据库 `firedre-blog` 共 **14 张业务表**（迁移 SQL 位于 `migrations/`，本地由 `cf-dev-shim` 按序幂等应用，生产用 `pnpm d1:migrate`）：

| 表 | 用途 |
|---|---|
| posts | 文章元数据（正文存 R2，由 `r2_key` 指向；`published` 标识发布状态） |
| posts_fts | 文章全文检索（FTS5 虚拟表，按 `slug` 关联 posts） |
| post_taxonomy | 分类 / 标签统一表（`type` 区分 `category` / `tag`） |
| notice_board | 公告栏（单行 `id=1`） |
| dynamics | 动态 / 说说 |
| site_settings | 站点设置强一致源（版本号驱动前台缓存失效） |
| rate_limits | 通用限流 + 登录失败锁定 |
| friends | 友链 |
| album_passwords | 相册访问密码 |
| admin_users | 后台管理员凭据（bcrypt） |
| album_webdav | 相册 WebDAV 源配置 |
| albums | 相册主表 |
| album_photos | 相册照片表（`sort_order` 排序，级联删除） |
| site_links | 站点外链（导航栏 / footer / 资料卡 / 打赏） |

迁移历史：`0001_core_posts` → `0002_social` → `0003_system` → `0004_social_data`（种子）→ `0005_admin_users` → `0006_album_webdav` → `0007_albums` → `0008_site_links` → `0009_site_links_extend`（种子）→ `0010_cleanup`（清理废弃表）。

---

## 后台管理

访问 `https://firedre.994613.xyz/admin/`（本地 `http://localhost:4321/admin/`）。

| 模块 | 说明 |
|---|---|
| 仪表盘 | 文章 / 动态 / 友链 / 标签统计 |
| 文章管理 | 列表 / 新建 / 编辑 / 删除（Vditor 编辑器，图片传 R2） |
| 站点设置 | 30 组配置：站点 / 显示 / 特效 / 个人资料 / 背景壁纸 / 侧边栏 / 字体 / 评论 / 封面 / 音乐 / Mermaid / 动态 / 友链 / 相册 / 打赏 / 页脚 / 许可 / 看板娘等 |
| 友链 / 链接 / 公告 / 动态 | 对应内容管理 |
| 关于页 | 在线编辑 `about/index.md` |
| 相册管理 | 相册增删改（含排序与上传） |

**配置生效机制**：后台修改 → 自动保存 → D1 写入 + 版本号递增 → 前台 HTML 缓存（`caches.default`，key 含版本号）失效 → 刷新前台即时生效。

**主题深浅模式**：后台与前台共用同一套主题令牌（`src/styles/variables.styl` 的 `:root` / `:root.dark`），跟随前台已选深浅（`localStorage.theme` / 系统偏好）。

---

## 项目结构

```
src/pages/              页面路由（含 /admin/* 后台、/api/* 接口）
src/components/admin/   后台管理组件（AdminApp SPA + 各功能面板）
src/components/         前台组件（widgets / layout / common / controls）
src/layouts/            页面布局
src/config/             静态配置（后台配置作为覆盖层注入）
src/styles/             样式与主题变量（variables.styl 为明暗两态令牌源）
src/lib/                基础设施（cf-dev-shim 本地垫片等）
server/                 业务层（posts / gallery / settings / auth / …）
migrations/             D1 迁移 SQL
types/                  全局类型（含 CloudflareEnv 绑定类型）
```

---

## 致谢与说明

- 前台主题基于 [Firefly](https://github.com/CuteLeaf/Firefly)（[文档](https://docs-firefly.cuteleaf.cn)），仅作云端动态化与后台扩展
- 本仓库不包含任何真实凭据（Secrets 均为环境变量注入）
- `ARCHIVE.md` 记录 Firedre 从 Firefly 改造的关键决策
