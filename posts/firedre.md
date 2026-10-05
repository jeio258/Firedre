---
title: Firedre：运行在 Cloudflare 上的动态博客系统
published: 2026-08-31
image: https://tc.alcy.cc/tc/20260429/0c0f723777b9c6cf7fd2baa16fa5f111.webp
description: Firedre 是运行在 Cloudflare 上的动态博客系统：Astro 7 SSR + D1 + R2 + 完整后台管理，文章、相册、友链、动态、公告、站点设置全部后台直改，保存即时生效，无需重新部署。
tags: [Astro, Cloudflare, 博客, 部署]
category: 技术
slug: firedre
---

## 🌟 项目概述

**Firedre** 是一个运行在 Cloudflare 上的**动态博客系统**。

它沿用了静态博客主题中那套清新的视觉与组件生态——配置方式、UI 组件、音乐 / 樱花 / mermaid / katex 等效果都保留（看板娘 / Live2D 已移除）——但已是**完全独立**的项目：内容层、数据层与部署形态都是本项目自己的实现，**不再与任何上游仓库同分支演进**。内容与配置全部上云（Cloudflare D1 / R2），并配套一整套后台管理系统：文章、友链、动态、公告、关于页、相册、站点设置全部可以在 `/admin/` 后台直接管理，**保存后前台即时生效，无需重新构建部署**。

- 🖥️ 在线预览：https://firedre.994613.xyz/
- ⭐ 开源地址：https://github.com/jeio258/Firedre
- 📖 上游主题文档（仅作参考）：https://docs-firefly.cuteleaf.cn

## 🚀 技术架构

```
浏览器 ── Cloudflare Pages（Workers SSR，Astro 7 + Svelte 5）
              │
              ├── D1  数据库  ：文章 / 站点设置 / 公告 / 动态 / 友链 / 链接 / 管理员
              ├── R2  存储    ：文章 Markdown、图片上传、相册、关于页
              └── Secret     ：SESSION_SECRET（会话签名密钥）
```

- **云端动态化**：Astro 7 SSR 模式，Cloudflare Workers 渲染，内容存 D1（强一致数据）+ R2（文件）
- **会话安全**：HMAC 签名 Cookie（HttpOnly / SameSite=Lax / 4 小时），登录失败限流（D1 计数），管理员密码仅存 bcrypt 哈希
- **全量 TypeScript**：前台 Astro/Svelte + 服务端业务层独立类型检查
- **后台 SPA**：Svelte 5 组件，后台页面切换无刷新

## 📖 功能一览

### 后台管理（/admin/）

首次访问会引导创建管理员账号（账号密码存 D1，bcrypt 加密）；之后登录进入管理后台：

| 模块 | 说明 |
|---|---|
| 仪表盘 | 文章 / 动态 / 友链 / 标签统计 |
| 文章管理 | 列表 / 新建 / 编辑 / 删除；内置 Vditor 编辑器，图片粘贴直传 R2；支持置顶、草稿、分类、标签、系列、访问密码（AES-256-GCM 加密正文）、拼音 Slug 自动生成；封面图可由「封面图」开关自动从随机图 API 获取 |
| 友链管理 | 友链增删改（名称 / 头像 / 地址 / 描述 / 标签 / 权重 / 启用） |
| 链接管理 | 导航栏、页脚、个人资料、打赏二维码四类站点链接（支持图片二维码） |
| 动态管理 | 类 memos 的短内容发布 |
| 公告管理 | 全站公告编辑 |
| 关于页 | Markdown 编辑 |
| 相册管理 | 相册增删改、照片上传，支持本地图床 / WebDAV 双数据源，相册可加密 |
| 站点设置 | **29 组配置**，覆盖主题全部可配置项，修改后「保存全部」统一生效 |

### 站点设置（30 组配置，后台按 5 大分类组织）

- **站点配置**：基本信息、个人资料
- **外观布局**：导航栏、侧边栏、背景壁纸、显示设置面板、特效设置、字体、封面图片、代码块主题
- **功能配置**：文章页底部区块、评论系统、音乐播放器、一言、Mermaid 图表、PlantUML 图表
- **页面配置**：哔哩哔哩、打赏、VNDB、MyAnimeList、番组计划、书签导航
- **扩展功能**：页脚、广告、许可证、统计分析

公告 / 动态 / 友链 / 相册另有专属编辑器。

**配置生效机制**：字段修改 → 「保存全部」写入 D1 → 配置版本号递增 → 前台页面缓存 key 变化即时失效 → **刷新前台立即看到新配置**。

### 前台页面

首页（列表 / 网格 / 瀑布流布局）、文章页、归档、分类、标签、系列、搜索、关于页、友链、留言板、动态、相册、书签导航、哔哩哔哩、番组计划、MyAnimeList、VNDB、打赏页，以及 RSS、Sitemap、robots.txt。

### 前台特效

音乐播放器、樱花飘落、波浪动画、katex 数学公式、mermaid 图表、加密文章解锁、Fancybox 图片预览、GitHub 卡片、代码分组、首页打字机效果等（看板娘/Live2D、Spine 已移除）。

## 🛠️ 部署指南

### 本地开发

```bash
pnpm install
pnpm dev            # http://localhost:4321
```

本地开发开箱即用：首次启动自动创建本地 D1（`.wrangler/local-state/local-d1.sqlite`）并按序应用全部迁移（`cf-dev-shim`），本地 R2 模拟为文件系统。**不自动创建管理员**——访问 `/admin/` 按引导创建自己的管理员账号即可。

### 部署到 Cloudflare Pages

**0. 云端资源（一次性）**

| 资源 | 用途 | 绑定名 |
|---|---|---|
| D1 `firedre-blog` | 数据库 | `DB` |
| R2 `firedre-blog` | 文件存储 | `BUCKET` |

```bash
npx wrangler d1 create firedre-blog     # 记录 database_id → 替换 wrangler.toml 的占位符
npx wrangler r2 bucket create firedre-blog
```

`wrangler.toml` 已声明两个绑定；其中 `database_id` 为占位符 `YOUR_D1_DATABASE_ID`，创建 D1 后替换即可。本项目**无需 KV**（页面缓存用 `caches.default`，会话为自有 Cookie）。

另需在 Pages 项目配置 Secrets（**至少**设置 `SESSION_SECRET`，≥32 位随机串，否则后台无法登录）：

```bash
npx wrangler pages secret put SESSION_SECRET --project-name firedre
# 可选：WEBDAV_PASSWORD
```

并应用数据库迁移：

```bash
pnpm d1:migrate
```

**方式一：Git 集成部署（连接仓库，push 自动部署）**

在 Cloudflare Dashboard **Workers & Pages → Create → Connect to Git** 选择仓库，项目 **Settings → Build configurations** 配置：

| 项 | 值 |
|---|---|
| Build command | `pnpm install && pnpm build` |
| Build output directory | `dist` |

> ⚠️ 构建命令是 **Dashboard/项目级配置**，`wrangler.toml` 无法承载；漏配会报 `No build command specified` / `Output directory "dist" not found`。随后在 **Settings → Bindings** 绑定 D1（`DB`）与 R2（`BUCKET`），在 Environment variables 加 Secrets。

**方式二：Wrangler 直传**

```bash
pnpm build
pnpm deploy    # wrangler pages deploy dist --project-name firedre
```

**初始化管理员**

部署完成后访问 `https://你的域名/admin/`，若提示尚无管理员则进入 `/admin/setup/` 创建；或首次用 Secrets 凭据登录自动落库为 D1 管理员。

## 📌 说明

- 仓库不包含任何真实凭据；会话密钥通过 Cloudflare Secrets 设置
- 配置版本号存 D1（强一致），避免 KV 最终一致性导致的"保存不生效"问题
- 前台主题相关的详细配置说明，参阅 [Firefly 官方文档](https://docs-firefly.cuteleaf.cn/)
