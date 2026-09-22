# 配置文件说明

本目录的配置真身已迁至 `shared/config/`（双端中立层，server 与 src 共用）；本目录仅保留：

```
src/config/
├── index.ts            # 配置索引 barrel（re-export @shared/config/*，统一导出）
├── runtime.ts          # re-export shim（真身在 shared/config/runtime.ts）
├── FooterConfig.html   # 页脚展示资源（仅 Footer.astro 使用）
└── README.md           # 本文件
```

配置修改请编辑 `shared/config/` 下的对应文件；`@/config` barrel 用法不变。

## ⚠️ settings 三件套已知漂移（2026-09-18 结构重构时核实）

后台表单 schema（`src/components/admin/adminSettingsSchema.ts`）/ 默认值（`shared/config/settings-defaults.ts`）/ 扁平化映射（`server/settings/flatten.ts`）三者字段存在以下**已核实现状差异**，统一会改变后台行为，故仅登记不修（除非实际引发 bug）：

1. **默认值注入**（schema 有、defaults 无，flatten 从 runtime getter 硬编码注入）：`comment.enabled=true`、`effects.waves/gradient=true`、`effects.bannerCarousel=false`、`mermaid.enabled=true`
2. **类型冲突**：`analytics` 组 defaults 为空 `{}`
3. **仅存在于 flatten**：`dynamic.memosEnable/memosApiUrl`、`dynamic.enabled`（const:true）
4. **字符串化**：`sponsor.sponsors` flatten 输出 JSON 字符串（源为数组）
5. **当前恒等但语义变换**（改动相关配置须复核 flatten）：`basic.siteUrl` 过 normalizeSiteUrl、`basic.keywords` join/split 往返、`nav.links` 映射丢弃未列字段、profile/license 的 String 强转
6. **groups 数不一致**：defaults 29 组（多 nav/dynamic/friends/gallery/announcement 无表单组）；schema 24 组
7. **tests 分支待同步**：main 已迁移至 `shared/` 并用 `@shared/*`/`@server/*` 别名，tests 分支旧相对路径 import 失效，merge 后需同步并跑 `pnpm test`

## 🚀 使用方式

### 推荐：使用配置索引（统一导入）
```typescript
import { siteConfig, profileConfig } from "@/config";
```

### 直接导入单个配置
```typescript
import { siteConfig } from "@shared/config/siteConfig";
import { profileConfig } from "@shared/config/profileConfig";
```

## 📋 配置文件列表

| 文件 | 说明 |
|------|------|
| `siteConfig.ts` | 站点基础配置（标题、描述、主题色、页面宽度、文章内容页配置等） |
| `analyticsConfig.ts` | 统计分析配置（Google Analytics、Microsoft Clarity、Umami、51la） |
| `announcementConfig.ts` | 公告配置（标题、内容、类型、链接等） |
| `backgroundWallpaper.ts` | 背景壁纸配置（壁纸模式、图片、横幅文字、水波纹等） |
| `commentConfig.ts` | 评论系统配置（Twikoo、Waline、Artalk、Giscus、Disqus） |
| `coverImageConfig.ts` | 封面图配置（文章封面图、随机封面图 API） |
| `displaySettingsConfig.ts` | 视图设置面板配置（面板总开关、各设置项开关） |
| `dynamicConfig.ts` | 动态页面配置（页面标题、描述、评论开关和每页显示数量） |
| `effectsConfig.ts` | 动画特效配置（樱花数量、速度、尺寸等） |
| `expressiveCodeConfig.ts` | 代码高亮配置（亮色/暗色主题、折叠、语言徽章） |
| `fontConfig.ts` | 字体配置（字体列表、回退、预加载） |
| `footerConfig.ts` | 页脚配置（自定义 HTML 注入，如备案号） |
| `friendsConfig.ts` | 友链页面设置（标题/描述/评论开关） |
| `licenseConfig.ts` | 许可证配置（CC 协议等） |
| `musicConfig.ts` | 音乐播放器配置（Meting API / 本地音乐、导航栏和侧边栏开关） |
| `navBarConfig.ts` | 导航栏配置（动态链接、LinkPresets 链接预设、搜索配置） |
| `plantumlConfig.ts` | PlantUML 图表渲染配置 |
| `profileConfig.ts` | 用户资料配置（头像、姓名、社交链接） |
| `sidebarConfig.ts` | 侧边栏布局配置（左侧/右侧/移动端组件列表） |
| `sponsorConfig.ts` | 打赏配置（打赏方式、打赏者列表） |

## 📝 说明

- 所有配置文件均可通过 `index.ts` 统一导入
- 每个配置文件对应 `types/` 目录下的独立类型定义文件
- `siteConfig.ts` 只保留站点核心信息，不聚合其他模块配置
- `navBarConfig.ts` 底部的 `LinkPresets` 可自由自定义导航栏链接的名称、图标和 URL
- `displaySettingsConfig.ts` 的视图设置面板默认关闭，除了修改配置里的 `enable`，也可以在部署平台（Vercel / Cloudflare 等）设置环境变量 `PUBLIC_DISPLAY_SETTINGS=true` 开启，无需改动配置文件；环境变量优先级更高，取值 `true/1/on/yes` 开启、`false/0/off/no` 关闭
