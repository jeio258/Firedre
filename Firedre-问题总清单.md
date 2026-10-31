# Firedre 问题总清单（可逐项勾选）

> 基线 `main @ df4b7d4`（版本 6.16.5）｜排查日期 2026-10-29
> 来源：6 路并行只读扫描（646 文件）+ 主控逐条回源核实 + 实跑 test/check/build
> 状态：✅ 已修 ｜ ⬜ 待修 ｜ ❓ 待裁决 ｜ ⛔ 已判定不做
> 证据级别：**[实测]** 跑过或直读确认 ｜ **[代码]** 结构推断

---

## 一、总览

| 域 | 总数 | 已修 | 待修 | 待裁决 | 不做 |
|---|---|---|---|---|---|
| A 安全边界 | 7 | 4 | 3 | 0 | 0 |
| B 数据一致性 | 8 | 3 | 4 | 1 | 0 |
| C 配置体系 | 26 | 1 | 4 | 21 | 0 |
| D 代码冗余 | 13 | 9 | 1 | 3 | 0 |
| E 类型层 | 6 | 0 | 3 | 3 | 0 |
| F 工程化 | 10 | 0 | 7 | 2 | 1 |
| G 性能 | 5 | 0 | 3 | 1 | 1 |
| H 文档/制度 | 2 | 1 | 0 | 1 | 0 |
| **合计** | **77** | **18** | **25** | **32** | **2** |

---

## A 安全边界

| ID | 位置 | 问题 | 影响 | 证据 | 状态 |
|---|---|---|---|---|---|
| A1 | `Navbar.astro:72,249` | 合并后的整份 30 组设置作为 island props 传给 `DisplaySettings` | `music.metingAuth`/webdav 凭据进每页 HTML 并被 HTML 缓存复制 | 代码 | ✅ 改走 `toClientSettings` |
| A2 | `posts/service.ts:476,384` | 加密文章正文与摘要明文写入 `posts_fts`；搜索不过滤 `password` | 口令保护可被全文搜索绕过 | 直读 | ✅ 加密不入索引 + SQL 过滤；旧数据需重存 |
| A3 | `api/settings/index.ts:104` | `{groups}` 分支无数组校验（单组分支有） | 组值可写数组污染 basic，读侧 spread 出 `"0"/"1"` 键 | 直读 | ✅ 统一 `isPlainRecord` |
| A4 | `albumWebdav.ts:213` | 加密判定用 `Boolean(albumPassword)`，忽略 `encrypted` 标记 | 口令行缺失但标记为加密时，WebDAV 目录可匿名列举 | 直读 | ✅ 改用 `encrypted \|\| albumPassword` |
| A5 | `Layout.astro:362,364` | `set:html` 注入 `JSON.stringify`，未转义 `<` | 标题含 `</script>` 可断出脚本块；CSP 当前 Report-Only | 代码 | ⬜ |
| A6 | `[...page].astro:22` + `middleware.ts:209` | 404 用 rewrite 实现，Astro 强制 200，软 404 被写入任意路径缓存 | 缓存键无界增长；搜索引擎可能收录软 404 | 代码 | ⬜ |
| A7 | `Layout.astro:417-429` | 设置版本变化时清空**全部**访客本地偏好 | 后台改任何设置，所有访客壁纸/布局偏好被重置 | 代码 | ⬜ |

---

## B 数据一致性

| ID | 位置 | 问题 | 影响 | 证据 | 状态 |
|---|---|---|---|---|---|
| B1 | `posts/service.ts:485` | 正文版本化 key 只写不删，注释称"对账脚本清理"但仓库无此脚本 | R2 孤儿随每次改稿线性增长 | 直读 | ⬜ 需设计回收策略 |
| B2 | `gallery/service.ts:365` | 删相册漏删 `album_webdav`；R2 前缀清理无 try | 同 slug 重建沿用旧源；R2 失败时 D1 已删却返 500 | 代码 | ⬜ |
| B3 | `gallery/password.ts` | 密文无密钥版本号 | `SESSION_SECRET` 轮换 → 全部相册锁死，无重加密路径 | 代码 | ⬜ |
| B4 | `posts:149`、`dynamic:47` | 分页 `Math.max(1, page)` 未取整 | 小数 offset 绑定 D1 报数据类型错 | 直读 | ✅ 加 `Math.floor` |
| B5 | `api/{posts,gallery,friends}` | 鉴权调用在 `try` 外 | 异常逃逸成框架 500，丢错误码语义 | 直读 | ✅ 移入 try |
| B6 | `admin/stats.ts:48-51,82` | "总字数"只累加 words Top6 | 仪表盘统计偏小 | 代码 | ⬜ |
| B7 | `posts/seed.ts:67` | 用户清空文章后默认文章复活 | 后台删空全部文章会被重新写入 | 代码 | ❓ 是否视为特性 |
| B8 | `posts_fts` 旧行 | 旧索引里仍存加密文章正文 | 搜索 SQL 已兜底，但索引本身仍含明文 | 直读 | ⬜ 需重存旧文一次 |

---

## C 配置体系（30 组 / 224 字段）

### C1 完全死的默认值（7，删字段）

| ID | 字段 | 证据 |
|---|---|---|
| C1 | `nav.social` | defaults 有，schema 无，runtime 无读取 |
| C2 | `vndb.mode` | 模式在 `vndb.astro` 硬编码 |
| C3 | `bangumi.mode` | 同上 |
| C4 | `dynamic.memosEnable` | `content.ts:355-359` 硬编码忽略 |
| C5 | `dynamic.memosApiUrl` | 同上 |
| C6 | `friends.enabled` | 页面开关走 `basic.pageFriends` |
| C7 | `gallery.enabled` | 页面开关走 `basic.pageGallery` |

### C2 后台能改、前台不读（14，删表单或修接线）

`cover.enable` `cover.defaultImage` `cover.configurable` `font.scale` `music.autoplay` `license.type` `license.url` `license.icon` `expressiveCode.darkTheme` `expressiveCode.lightTheme` `bilibili.enabled` `vndb.enabled` `myanimelist.enabled` `bangumi.enabled`

> 其中 `expressiveCode.*` 属 **传参 bug**（`Layout.astro:376` 传错参数恒得 `{}`），应修不应删。

### C3 结构性问题

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| C22 | `Layout.astro:376` | `getExpressiveCodeConfig(settings)` 传参错误，两字段永久失效 | ⬜ |
| C23 | `AdminNoticeEditor.svelte:48` | `announcement` 组无写入者（公告实际写 `notice_board`），`announcement.enabled` 永远关不掉 | ⬜ |
| C24 | `site.ts:90` vs `bangumi.astro:10` | 番剧 API 双真源，defaults 的 `api.bangumi.pro` 永不生效 | ⬜ |
| C25 | `translation.ts:88`、`Layout.astro:91` | `basic.lang` 无后台入口；6 语言包齐全但只发 zh_CN；19 处硬编码中文 | ⬜ |
| C26 | `src/config/README.md:17` | 写"29 组"，实际 30 | ✅ 已改 |

### C4 无入口（前台读、后台改不了）36 项

`basic.{bangumi,bilibili,favicon,foldArticle,imageOptimization,lang,mal,navbar,pagination,postListLayout,vndb}`
`nav.navItems` `panel.overlaySwitchable` `post.{generateOgImages,outdatedThreshold,rehypeCallouts,showLastModified}`
`sidebar.{enable,leftComponents,mobileBottomComponents,position,rightComponents,tabletSidebar}` `theme.wallpaperBase`
`profile.links`（hidden）`announcement.{enabled,sections,title,content}` `dynamic.{enabled,title,description,profileUrl,showComment,itemsPerPage,apiUrl}`

---

## D 代码冗余与残留

| ID | 位置 | 内容 | 状态 |
|---|---|---|---|
| D1 | `covers/`（2 avif） | 静态博客时代遗留，运行时走 R2 | ✅ 已删 |
| D2 | `gallery/`（2 个 **0 字节** avif） | 同上 | ✅ 已删 |
| D3 | `public/favicon/firefly-{128,180}.png` | 0 引用 | ✅ 已删 |
| D4 | `tests/tmp-csscov*.mjs` | 临时脚本，硬编码本机路径 | ✅ 已删 |
| D5 | `src/pages/i18n.js.ts` | 死端点，前台走 Layout 内联 | ✅ 已删（含 `_headers`/middleware/QA 引用） |
| D6 | `escape-html.ts:10` | `escapeHtmlAttr` 与 `escapeHtml` 完全等价 | ✅ 合并 |
| D7 | `api/settings/client.ts:27` | `toClientSettings(redactSensitive(all))` 双重脱敏 | ✅ 去重 |
| D8 | `tsconfig.server.json:15`、`vitest.config.ts:29` | 指向不存在的 `utils/**` | ✅ 已删 |
| D9 | `collapse-routes.mjs:10` | `/pio/` 指向不存在的目录 | ✅ 已删 |
| D10 | `content.ts:212` | 字体回退 `["--font-fangzheng-zizhu"]` 复活已移除的 1.3MB 字体 | ✅ 改空数组 |
| D11 | `shared/constants/github-card-data.json` | 内容为 `{}`，仅被 rehype 插件 import | ❓ 可内联后删 |
| D12 | `adminSettingsSchema/index.ts:11` | GROUP_ORDER 手工列表，与 defaults 易漂移 | ❓ 可派生 |
| D13 | `config/index.ts:54-61` | `resolveNavbarMode` 的 `stickyNavbar` 兼容分支 | ⛔ 保留（旧 D1 行兼容） |

---

## E 类型层

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| E1 | `global.d.ts:118-142` | `SearchResult` 仍是 Pagefind 形状（13 字段），实际只有 3 字段 | ⬜ |
| E2 | `global.d.ts:92-96` | `__allPostMetaCache` 缺 description/category/password | ⬜ |
| E3 | `src/types/iconify-svelte-offline.d.ts` | 覆盖声明缺 color/rotate/inline，与包自带类型冲突 | ❓ 删除后需跑 svelte-check |
| E4 | `cloudflare-env.d.ts:2` | `env` 声明为 `Record<string, any>`，导致 `api.ts` 双断言 | ⬜ 改 `CloudflareEnv` |
| E5 | 全仓 | 62 处 `as unknown as`、28 处 `Astro.locals.settings as`、14 处 `@ts-ignore` | ❓ 大工程，需与 SettingsView 强类型化一起做 |
| E6 | tsconfig 三份 | `shared/**` 同时属三套配置，同一文件在三种 types 环境下检查 | ❓ |

---

## F 工程化

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| F1 | `.gitignore:71-76` | `tests/`、`scripts/qa/`、`vitest.config.ts` 未跟踪 | ❓ 用户曾明确决策 |
| F2 | `.github/` + `.gitignore:73` | 无 CI；CF Pages 只跑 `install && build` | ❓ |
| F3 | `unused-warn-guard.mjs:41` | 基线缺失时自动生成并 exit 0（fail-open） | ⬜ |
| F4 | `package.json:12` | `check` 未串 `test`、`type-check:server`、`biome` | ⬜ |
| F5 | `dist/` | 双份 merman wasm 6.92MB + 4.85MB（哈希不同） | ⬜ |
| F6 | `copy-vditor.mjs` + `_headers` | vditor 24MB 7 天强缓存、路径无版本号 | ⬜ |
| F7 | `collapse-routes.mjs:26` | `slice(0,100)` 超限静默截断 | ⬜ |
| F8 | `package.json:41,87` | `typescript`、`@astrojs/check` 放在 dependencies | ⬜ |
| F9 | `@astrojs/cloudflare@12.6.13` | peer 声明 `astro ^5.7.0`，实装 7.2.8 | ❓ |
| F10 | `wrangler.toml` | `compatibility_date=2025-01-01` 明显落后 | ⬜ |
| F11 | `scripts/qa/` | 23 个文件只挂 8 个 npm script，14 个孤儿 | ⛔ 工具链脚本，非死码 |

---

## G 性能

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| G1 | `notice/service.ts` | `getNotice` 无 isolate 缓存 | ⬜ |
| G2 | `siteLinks/service.ts` | `listEnabledSiteLinks` 无缓存 | ⬜ |
| G3 | `rateLimiter.ts:76` | 每个放行请求附带一次全表 DELETE | ⬜ |
| G4 | `taxonomy.ts:160,200`、`gallery/d1.ts:109,139` | 归档 GROUP BY 走临时表；相册缺 `(album_slug,sort_order,id)` | ⬜ |
| G5 | `Layout.astro` 全量元数据内联 | 24KB 未压缩 | ⛔ brotli 后仅省几 KB，已判降级不做 |

---

## H 文档与制度

| ID | 位置 | 问题 | 状态 |
|---|---|---|---|
| H1 | `src/config/README.md` | 组数 29 → 30 | ✅ |
| H2 | `Firedre.log` | 双排序、A3/A6/A9/A14 已修仍标 ❌、C1 一号两义 | ❓ 制度问题 |

---

## 已判定不做的伪问题（勿再排查）

| 结论 | 依据 |
|---|---|
| `safeUrl` 私网绕过（`127.1`、`2130706433`） | WHATWG `new URL()` 会规范化 IPv4 字面量 |
| dynamics「草稿外泄」 | `published` 是该表的时间戳，不是发布开关 |
| FTS 特例输入 → 500 | 28 个特殊输入实测均不抛 |
| 23 个 woff2 冗余 | 23/23 均被引用 |
| 脱敏正则过宽 | 客户端不消费被脱敏字段 |
| HTML 缓存形同虚设 | 实测写入后立即命中 |
| 关键 CSS 拆分 / beasties / inlineStylesheets | 已实测回滚（TBT 726–3805ms） |
| A2/A3 HTML 瘦身 | brotli 后仅省几 KB |

---

## 待你一次拍板的四个批次

**批次 1 · 安全收口（3 项，独立，可并行）**
A5 `Layout` 内联 JSON 转义 ｜ A6 软 404 不写缓存 ｜ A7 偏好清空收窄到设置项

**批次 2 · 配置去死（21 项 + 4 结构项，一个原子单元）**
删 C1–C7 与 C8–C21 中确认无接线者；修 C22 传参 bug；决定 C23/C24/C25 是接线还是删

> 这一批会**减少后台表单控件**，是唯一会改变你看到的界面的批次，所以必须你点头。

**批次 3 · 数据生命周期（4 项，需一次设计）**
B1 R2 孤儿回收 ｜ B2 删相册级联 ｜ B3 密钥版本 ｜ B8 旧索引重存

**批次 4 · 工程门禁（4 项）**
F3 fail-open ｜ F4 check 串联 ｜ F5 双 wasm ｜ F7 静默截断

> F1/F2 属制度选择，不写代码；F5 需先确认两份 wasm 的真实来源差异。
