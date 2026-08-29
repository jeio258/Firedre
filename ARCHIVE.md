# Firedre 项目归档说明（2026-08-29 更新）

> 本文件记录项目的最终归档状态，供日后恢复或继续开发使用。

## 一、项目位置与代码

- **项目根目录**：`/home/lyxy/pi/Firedre`
- **Git 仓库**：已初始化，工作区干净（`git log --oneline` 可查历史）
- **远端资源**（Cloudflare 账号已绑定）：
  - Pages 项目：`firedre`（`https://firedre.pages.dev`）
  - D1 数据库：`firedre-blog`（id `a38bf823-90f7-4e78-ae66-4730522c332a`）
  - R2 存储桶：`firedre-blog`
  - KV：`SESSION`（id `5a217ff6eba940bdb48e3029ec816523`）
  - Secrets：`ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_API_TOKEN` / `SESSION_SECRET` / `WEBDAV_PASSWORD` 已配置
  - 数据已迁移：14 篇文章、4 条动态、友链、关于页、公告、2 个相册（R2+D1）

## 二、完成状态（对照 PLAN.md）

### ✅ 已完成并生产实测
1. 后端服务层全部移植（posts/links/about/notice/gallery/htmlFiles/dynamic/WebDAV/auth/限流）
2. 运行时 Markdown 渲染管线（纯 unified，wiki-link/katex/plantuml/mermaid 客户端渲染）
3. API 层全部端点（与 AueXUE URL/结构 1:1）
4. 前端纯动态化（首页/文章/分类/标签/系列/归档/搜索 FTS5/友链/关于/留言板/RSS/动态）
5. 部署链路（Cloudflare Pages + D1/R2/KV，**v14 适配器，无需 patch**）
6. 迁移脚本 7 个（posts/dynamic/links/about/gallery/notice/spec）
7. 后台管理面板（10 个路由，代码完成）
8. **安全强化**：强制 SESSION_SECRET，移除明文密码支持
9. **测试覆盖**：vitest 单元测试（认证流程 + 配置合并逻辑）

### ⚠️ 未完成/已知遗留
- 后台面板部署后回归测试（最后部署被中断）
- 本地 `astro dev` 的 miniflare D1 兼容问题（可用 `wrangler dev` 或远程替代）
- 演示文章封面为本地相对路径（后台改 URL 即可）
- OG 图仍为构建期生成（`og/[...slug].ts` 保留 content collection）

## 三、关键构建/部署流程（恢复时用）

```bash
cd /home/lyxy/pi/Firedre
pnpm install

# 1. 数据库迁移（远程）
pnpm d1:migrate

# 2. 后台凭据（secrets，一次设置）
echo "admin" | npx wrangler pages secret put ADMIN_USERNAME --project-name firedre
echo "$2b$10$your.bcrypt.hash" | npx wrangler pages secret put ADMIN_PASSWORD --project-name firedre
echo "dev-token-..." | npx wrangler pages secret put ADMIN_API_TOKEN --project-name firedre
echo "your-strong-session-secret" | npx wrangler pages secret put SESSION_SECRET --project-name firedre

# 3. 构建 + 部署（v14 适配器，无需 patch）
pnpm build
rm -rf .wrangler/deploy
npx wrangler pages deploy dist --project-name firedre --commit-dirty=true

# 4. 数据迁移（首次或内容变更后）
pnpm migrate:posts && pnpm migrate:dynamic && pnpm migrate:links \
  && pnpm migrate:about && pnpm migrate:gallery && pnpm migrate:notice && pnpm migrate:spec
```

## 四、关键架构决策（日后维护必读）

1. **@astrojs/cloudflare v14.2.5 + Astro 7.2.3**：已升级至 v14，无需 patch-pages-worker 兼容补丁，构建直接可用。

2. **安全强化（2026-08-29）**：
   - **强制 SESSION_SECRET**：不允许降级使用 ADMIN_PASSWORD 或 ADMIN_API_TOKEN 作为签名密钥
   - **移除明文密码支持**：仅支持 bcrypt 哈希，首次登录检测到明文时自动升级
   - 运行 `pnpm migrate-password <新密码>` 生成 bcrypt 哈希

3. **测试覆盖**：
   - 使用 vitest 运行单元测试：`pnpm test`
   - 认证流程测试：`tests/auth.test.ts`
   - 配置合并逻辑测试：`tests/settings-merge.test.ts`

4. **路由注意**：根 catch-all 已移除，HTML 文件服务改走 `src/middleware.ts`（避免抢占首页）

5. **运行时渲染**：`server/posts/render.ts` 为纯 unified 管线（不依赖 @astrojs/markdown-remark，避免 shiki/oniguruma 撑爆 3MiB 限制）；mermaid 由 `MarkdownEnhancer.svelte` 客户端渲染，代码高亮用 `public/assets/js/highlight.min.js`

6. **纯动态**：生产页面全部走 D1/R2，Content Collections 仅保留给 og 图构建期使用

7. **Worker 体积控制**：图标集已裁剪为实际使用（156 个）、syntaxHighlight 关闭、expressive-code 移除、imageService 用 passthrough、sharp 不入包

## 五、恢复继续开发时的切入点

1. 部署后台并回归：`/admin/` 登录 → 文章 CRUD/友链/公告/相册/HTML 文件
2. 自定义站点信息：`src/config/siteConfig.ts`（当前为 Firefly 演示值）
3. 本地开发：`pnpm dev`（纯 UI 迭代）或 `wrangler dev dist/_worker.js/index.js --compatibility-date 2025-01-01 --compatibility-flags nodejs_compat --local`（API 测试需先构建）
