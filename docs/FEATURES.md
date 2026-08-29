# Firedre — 功能清单与对比

> Firedre = **纯净 Firefly 模板（Astro + Svelte）** + 云端动态化（Cloudflare D1/R2 + 后台管理）。
> 前台配置（`src/config/*.ts`）、UI 组件、展示效果均为 Firefly 原样；后台与数据层为新增动态化能力。

## 一、具体功能清单

### A. 前台展示（Firefly 原样，逐项保留）

| 功能 | 说明 |
|---|---|
| 首页文章流 | 置顶 + 分页 + 卡片式布局（列表/网格/瀑布流可切换） |
| 横幅壁纸 | 首页/内页双高度横幅 + 壁纸图片 |
| 侧栏 | 头像、站点信息、站点统计、文章日历、公告、分类、标签、归档、动态 |
| 明暗主题 | 一键切换 + 主题色配置（`siteConfig`） |
| 看板娘 | Live2D（`pio/models`）+ Spine 模型 + 气泡提示 |
| 音乐播放器 | Meting 网易云歌单 + 播放器 UI + 背景播放 |
| 樱花/波浪特效 | SakuraEffect + WavesEffect |
| 打字机/滚动指示 | 横幅标题打字机 + 滚动提示 |
| 文章渲染 | wiki-link 卡片、mermaid、katex、plantuml、代码高亮/折叠/复制、加密文章密码门、目录 TOC、图片灯箱、GitHub 卡片、代码组 |
| 文章页 | 字数/阅读时间、前后篇导航、相关推荐、系列导航、评论（Twikoo/Waline/Giscus 等） |
| 页面 | 关于、友链、留言板、搜索（客户端+服务端）、归档、分类、标签、系列、动态、赞助、书签导航、404 |
| 数据页 | bangumi / bilibili / vndb / myanimelist（外部 API 集成，原样保留） |
| SEO | OG 图、JSON-LD、sitemap、RSS、robots |

### B. 动态化（新增能力）

| 功能 | 说明 |
|---|---|
| 云端存储 | 文章 Markdown 存 R2，元数据/索引存 D1（SQLite + FTS5） |
| 实时发布 | 后台发文/编辑 → 前台即时生效，无需重新部署 |
| 全文搜索 | D1 FTS5 服务端搜索 + 客户端 Fuse.js |
| API 体系 | `/api/posts`（CRUD/搜索/分类/标签/归档/邻居）、`/api/links`、`/api/about`、`/api/notice`、`/api/gallery`、`/api/html-files`、`/api/dynamics`、`/api/admin`、WebDAV 相册代理 |
| 动态内容页 | 动态页（memos 时间线）、日历、公告、站点统计全部由 D1 驱动 |

### C. 后台管理（/admin）

| 模块 | 说明 |
|---|---|
| 登录 | 账号密码 + HMAC 会话 Cookie（4h）+ IP 登录限流（5 次/15 分钟） |
| 仪表盘 | 文章/动态/友链/标签/分类统计 |
| 文章管理 | 列表（搜索/筛选）、新建、编辑（Vditor 编辑器 + 图片上传 R2）、封面/分类/标签/置顶/密码/系列字段 |
| 友链管理 | Markdown 编辑（frontmatter linkGroups） |
| 公告管理 | 区块/行结构编辑 |
| 关于页 | Markdown 编辑 |
| 相册管理 | 相册 Hub + 相册编辑（密码/WebDAV 源/照片） |
| HTML 文件 | 自建页面（/{slug}.html）管理 |

### D. 工程能力

| 项 | 说明 |
|---|---|
| 迁移脚本 | `migrate:posts/dynamic/links/about/gallery/notice/spec`（本地/远程） |
| 数据库迁移 | `d1:migrate`（7 张表） |
| 部署 | `pnpm build && wrangler pages deploy`（或 GitHub 集成） |
| 本地开发 | `pnpm dev`（UI）+ `wrangler pages dev`（全量） |

## 二、对比

### Firedre vs 纯净 Firefly（静态模板）

| 维度 | Firefly（静态） | Firedre（动态） |
|---|---|---|
| 前台 UI/配置/效果 | — | **完全一致**（同一模板复制，0 改动） |
| 文章管理 | 手写 Markdown + Git 提交 | 后台网页编辑器（Vditor） |
| 发布 | 重新构建部署 | **即时生效**（API 写入 D1/R2） |
| 数据存储 | 本地文件 | D1 + R2（云端） |
| 搜索 | Pagefind（构建时索引） | FTS5 + Fuse.js（实时） |
| 后台 | 无 | **完整后台**（文章/友链/公告/相册/HTML） |
| 评论/音乐/看板娘等 | 原样 | 原样 |

### Firedre vs AueXUE（Valaxy 动态博客）

| 功能 | AueXUE | Firedre |
|---|---|---|
| 前台主题 | Sakura（Valaxy） | **Firefly（Astro 模板，UI 更丰富）** |
| 文章 CRUD + 云端 | ✅ | ✅（等价移植） |
| 后台管理 | ✅（Vue） | ✅（Svelte，等价功能） |
| 加密文章 | 部分 | ✅（Firefly 原样密码门） |
| wiki-link / mermaid / plantuml | 无 | ✅（Firefly 原样渲染） |
| WebDAV 相册 | ✅ | ✅（移植） |
| 登录限流 | ✅ | ✅（移植） |
| FTS 搜索 | ✅ | ✅（移植） |

### Firedre vs flare-stack-blog（已放弃的方向）

| 维度 | flare-stack-blog | Firedre |
|---|---|---|
| 前台 UI | 自有主题（非 Firefly） | **Firefly 原样** |
| 内容模型 | tiptap JSON / 标签 | Firefly 的 Markdown / 分类+标签 |
| 配置方式 | 后台系统配置 | **Firefly 的 `src/config/*.ts`** |
| 展示效果 | 不同 | **Firefly 全套**（看板娘/音乐/樱花等） |
| 后台 | 完整（AI 审核等） | 完整（AueXUE 风格） |
| 结论 | 前台不是 Firefly → **放弃** | ✅ 符合"完全使用 Firefly"要求 |

## 三、验证状态

- ✅ 生产实测（https://2b48e060.firedre.pages.dev）：12 个页面 200、14 个 API 200、后台登录成功、wiki-link/katex/mermaid 渲染确认
- ✅ 构建链：`astro build` + manifest 注入补丁 + `wrangler pages deploy`
- ⚠️ 待完善：后台面板浏览器端回归（代码完成未逐一 UI 点击测试）、README 部署文档
