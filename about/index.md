---
layout: post
title: 关于本站
---

## 关于本站

**Firedre** 是 [Firefly](https://github.com/CuteLeaf/Firefly) 主题（Astro 7 + Svelte 5）的**云端动态化版本**：前台完整保留 Firefly 的清新风格与组件（音乐播放器、樱花特效、Mermaid、KaTeX、代码高亮等），并把原本依赖本地 Markdown 文件的内容层升级为运行在 Cloudflare 上的**动态站点** —— 自带后台管理，无需服务器即可长期稳定运行。

> 本站即为本项目的示例站点：文章、动态、相册、友链与页面内容都可以在后台直接编辑。

### 🧱 技术架构

| 层 | 选型 |
| --- | --- |
| 前端框架 | Astro 7（SSR）+ Svelte 5 |
| 托管 | Cloudflare Pages（Workers SSR） |
| 数据 | Cloudflare D1 |
| 文件 | Cloudflare R2 |
| 会话 | 自有 HMAC Cookie（不依赖 KV） |
| 认证 | bcrypt 密码哈希 + 登录限流 |
| 样式 | Tailwind CSS 4 |

### ✨ 相比上游 Firefly 的改造

- **内容上云**：文章、动态、相册、书签导航等从仓库内的 Markdown 文件搬到 D1，改内容不再需要重新构建
- **完整后台**：`/admin/` 可视化管理文章、相册、友链、公告、动态、关于页与全部站点设置
- **设置即时生效**：后台显式保存后前台立即生效（版本号驱动缓存失效）
- **文件可管理**：封面与相册图片存于 R2，支持后台上传与替换
- **本地开箱即用**：内置 `cf-dev-shim`，首次启动自动创建本地 D1 / R2 并应用迁移
- **部署开箱即用**：空库首次访问自动建表并播种默认内容，无需手工初始化
- **边缘缓存与韧性**：HTML 边缘缓存 + 陈旧资源自愈重载

### 🔗 相关链接

- 🖥️ 在线预览：<https://firedre.994613.xyz>
- ⭐ 本项目开源地址：<https://github.com/jeio258/Firedre>
- 📚 上游主题 Firefly：<https://github.com/CuteLeaf/Firefly>
- 📚 Firefly 的基底 Fuwari：<https://github.com/saicaca/fuwari>

---

感谢你的来访！如果这个项目对你有帮助，欢迎到仓库点一个 ⭐。
