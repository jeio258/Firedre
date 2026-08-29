# Firedre

> **纯净 Firefly 模板（Astro 7 + Svelte 5）+ 云端动态化（Cloudflare D1 / R2 / KV）+ 完整后台管理**

Firedre 以 [Firefly](https://github.com/CuteLeaf/Firefly) 主题为基底，**前台 1:1 保留原版**（配置方式、UI 组件、看板娘/音乐/樱花/mermaid/katex 等全部效果），在此之上实现：

- **后台管理**（`/admin/`）：文章 / 相册 / 友链 / 公告 / 关于页 / HTML 文件 / 站点设置
- **站点设置**：30 组配置（对齐 Firefly 全部配置文档），修改后**自动保存、前台即时生效**
- **云端存储**：D1（强一致数据）+ R2（文章/图片/文件）+ KV（配置镜像 + HTML 缓存）
- **部署**：Cloudflare Pages（Workers SSR）

在线地址：https://firedre.pages.dev

---

## 快速开始

### 本地开发

```bash
pnpm install
pnpm dev            # http://localhost:4321
```

本地开发**开箱即用**（无需手动迁移）：
- 首次启动自动创建本地 D1（`.wrangler/local-state/local-d1.sqlite`）并应用全部迁移
- 自动生成 `.dev.vars`（后台账号 `admin` / `firedre-admin-8888`）
- 本地 R2 模拟为文件系统（`.wrangler/local-state/local-r2/`）

> 需要本地文章数据时运行：`pnpm migrate:posts:local`（其余数据同理：`migrate:dynamic:local` / `migrate:gallery:local` 等）

### 部署到 Cloudflare Pages

前置：已安装 wrangler 并登录（`npx wrangler login`）。

```bash
# 1. 创建资源（一次性）
npx wrangler d1 create firedre-blog                      # 记录 database_id → 填入 wrangler.toml
npx wrangler r2 bucket create firedre-blog
npx wrangler kv namespace create SESSION                 # 记录 id → 填入 wrangler.toml

# 2. 数据库迁移（远程）
pnpm d1:migrate

# 3. 后台凭据（secrets，一次设置）
# 密码必须为 bcrypt 哈希（运行 pnpm migrate-password 生成）
echo "admin" | npx wrangler pages secret put ADMIN_USERNAME --project-name firedre
echo "$2b$10$your.bcrypt.hash" | npx wrangler pages secret put ADMIN_PASSWORD --project-name firedre
echo "dev-token-..." | npx wrangler pages secret put ADMIN_API_TOKEN --project-name firedre
# 会话签名密钥（必须配置，不允许使用弱凭据降级）
echo "your-strong-session-secret-min-32-chars" | npx wrangler pages secret put SESSION_SECRET --project-name firedre

# 4. 构建 + 部署（v14 适配器，无需 patch）
pnpm build                         # 自动包含 copy-vditor
rm -rf .wrangler/deploy
npx wrangler pages deploy dist --project-name firedre --commit-dirty=true
```

### 内容数据迁移（首次部署后）

将模板的静态内容迁移到云端（数据源：`src/content` 与 `public`）：

```bash
pnpm migrate:posts      # 文章 → D1 + R2
pnpm migrate:dynamic    # 动态 → D1
pnpm migrate:links      # 友链 → R2
pnpm migrate:about      # 关于 → R2
pnpm migrate:gallery    # 相册 → R2
pnpm migrate:notice     # 公告 → D1
```

---

## 后台管理

访问 `https://firedre.pages.dev/admin/`（本地为 `http://localhost:4321/admin/`）。

| 模块 | 说明 |
|---|---|
| 仪表盘 | 文章/动态/友链/标签统计 |
| 文章管理 | 列表 / 新建 / 编辑（Vditor 编辑器，图片上传至 R2）/ 删除 |
| 站点设置 | **30 组配置**：站点 / 显示面板 / 个人资料 / 背景壁纸 / 导航栏 / 侧边栏 / 字体 / 代码块 / 评论 / 封面 / 加密 / 音乐 / Mermaid / PlantUML / 动态 / 友链 / 相册 / 哔哩哔哩 / 打赏 / VNDB / MAL / 番组 / 书签 / 特效 / 公告 / 页脚 / 广告 / 许可 / 看板娘 / 统计 |
| 友链 / 公告 / 关于页 | 内容编辑 |
| 相册管理 | 相册增删改（含上传） |
| HTML 文件 | 自定义静态页（`/{slug}.html`） |

**配置生效机制**：任何字段修改 → 1.2s 自动保存 → D1 写入（强一致）+ KV 镜像 + 版本号递增 → 前台 HTML 缓存（KV，key 含版本号）即时失效 → **刷新前台立即看到新配置**。

---

## 架构

```
浏览器 ── Cloudflare Pages（Workers SSR，Astro 7 + Svelte 5）
              │
              ├── D1 firedre-blog   （强一致源：posts/settings/notice/dynamics/…）
              ├── R2 firedre-blog   （文章 markdown、封面、相册、HTML 文件、上传图）
              ├── KV SESSION       （配置镜像 + HTML 缓存 + 会话辅助）
              └── Secrets          （ADMIN_USERNAME/PASSWORD/API_TOKEN/SESSION_SECRET/WEBDAV_PASSWORD）
```

- 前台页面：100% Firefly 原样（静态配置在 `src/config/*.ts`，后台配置作为覆盖层注入）
- 会话：HMAC 签名 Cookie（HttpOnly / SameSite=Lax / 4h），**强制要求 SESSION_SECRET**（不允许使用弱凭据降级），登录限流 5 次/15 分钟（D1）
- 密码：仅支持 bcrypt 哈希（明文已废弃，首次登录自动升级）
- 渲染：读时渲染（unified markdown 管线），mermaid/katex 客户端渲染

## 目录速览

```
src/pages/           页面路由（含 /admin/* SPA 后台、/api/* 接口）
src/components/admin/ 后台管理组件（AdminApp SPA + 各功能面板）
server/              业务层（posts/gallery/settings/auth/…）
scripts/             迁移、构建脚本（copy-vditor / extract-manifest / migrate-*）
migrations/          D1 迁移 SQL
```

---

## 说明

- 后台账号密码在部署时通过 secrets 设置；本仓库不包含任何真实凭据
- `ARCHIVE.md` 记录 Firedre 从 Firefly 动态化改造的完整过程与关键决策
- 前台主题相关文档见 Firefly 官方：https://docs-firefly.cuteleaf.cn
