# 配置系统统一重构设计

日期：2026-08-30
状态：核心修复已完成并验证（方案 A）
目标：让 `src/config/runtime.ts` 成为前台唯一配置读取入口，所有组件统一走它，消除"平铺/嵌套混用、单组件单读取"的混乱，使"后台改 → 前台全局生效"。

## 1. 背景与问题

当前配置链路：

```
后台 /admin → PUT /api/settings/ → D1(site_settings) → 版本号+1
      ↓
前台请求 → middleware 读取 D1 → 合并(静态默认 + D1覆盖) → locals.settings
      ↓
前台组件直接读 settings.xxx（平铺字段 / settings.basic?.title / settings.theme.mode 等混用）
```

项目已存在统一核心 `src/config/runtime.ts`，提供 `getSiteConfig` / `getWallpaperConfig` / `getProfileConfig` 等（接收 `Astro.locals`）与 `getXxxConfigFromWindow()`（客户端读 `window.__FIREFLY_SETTINGS__`）。设计目标正是"后台改 → 实时生效，静态 config 仅兜底"。

**但统一只完成了 1/9**：仅 `src/utils/setting-utils.ts` 使用了 runtime。其余 8 个前台核心组件仍直接手写读取 settings，导致：

### 具体缺陷

1. **背景图 bug**（`src/layouts/MainGridLayout.astro`）：
   ```js
   if (desktopUrls.length && backgroundImages.desktop.length) {   // ① 依赖静态默认图非空
       backgroundImages.desktop = [...desktopUrls, ...backgroundImages.desktop]; // ② 拼接而非替换
   }
   ```
   - ① 静态默认图（`d1.avif` 等）为空时后台图完全不显示
   - ② 后台设置的图是拼接在默认图前面，轮播/多图时仍混入默认图
   - runtime 的 `getWallpaperConfig` 已是替换语义，但未被使用

2. **壁纸模式双来源打架**（`DisplaySettingsIntegrated.svelte` / `Layout.astro` inline script）：
   - 初始读 D1 `settings.theme.mode`，`onMount` 被 `localStorage` 覆盖
   - `Layout` inline script：`isWallpaperSwitchable ? localStorage.getItem("wallpaperMode") || default : default`
   - 两个来源（服务器 D1 与浏览器 localStorage）没有统一优先级约定

3. **标题/副标题混合路径**（`src/layouts/Layout.astro`）：
   - `effectiveTitle` 走嵌套 `settings.basic?.title`（因为 title 是 conflictedKey，被 middleware 从平铺层剔除）
   - `siteSubtitle` 走平铺 `settings.subtitle`（非冲突键，被平铺）
   - 两条路径语义不一致，且未走 runtime

4. **runtime.ts 不完整**：缺多个字段的 getter（见 §3），无法支撑"所有组件统一接口"。

5. **死字段**：`fullscreenBg` 在 settings-defaults 有定义、后台不可配、前台不读取，误导用户。

## 2. 目标架构

**范围基准**：以官方文档 `https://docs-firefly.cuteleaf.cn/zh/guide/getting-started.html`「配置文件概览」列出的 22 个配置模块为准：`siteConfig` `dynamicConfig` `navBarConfig` `sidebarConfig` `profileConfig` `backgroundWallpaper` `commentConfig` `musicConfig` `fontConfig` `coverImageConfig` `expressiveCodeConfig` `effectsConfig` `announcementConfig` `footerConfig` `licenseConfig` `friendsConfig` `sponsorConfig` `analyticsConfig` `galleryConfig` `mermaidConfig` `plantumlConfig` `pioConfig`。

**已核实**：runtime.ts 对这 22 个模块**全部有对应 getter**。本重构目标是把这些 getter 用起来、补全缺口字段、让前台统一生效。

```
后台 /admin → PUT /api/settings/ → D1 → 版本号+1
      ↓
前台 SSR: Astro.locals.settings（middleware 合并，不变）
      ↓
getSiteConfig(locals) / getWallpaperConfig(locals) / getPostConfig(locals) / ...  ← 唯一入口
   ↑ 所有 .astro 组件从这里读，不再直接碰 settings.xxx
客户端: window.__FIREFLY_SETTINGS__ → getXxxConfigFromWindow()
   ↑ 所有 .svelte 组件从这里读
```

- **接口统一**：任何组件不直接访问 `settings` 原始对象（除 runtime.ts 内部与 admin 组件、middleware）。所有前台读取经 runtime getter。
- **后台设置 = 全局默认**；用户在前台手动切换 = 个人偏好，localStorage 覆盖默认。优先级约定（唯一）：
  - **未手动设置**：用后台默认值（后台改 → 全局生效）
  - **已手动设置**：用 localStorage 值（保留个人偏好）
  - 该约定统一在 `setting-utils` 的 `getStoredWallpaperMode` 等函数实现，所有组件复用，不各自实现。

## 3. 现状核对与 runtime.ts 缺口

**已确认**：runtime.ts 已有 20 个 getter，覆盖大多数 config 模块（site/profile/comment/music/wallpaper/footer/effects/pio/license/sponsor/dynamic/announcement/navbar/sidebar/cover/font/expressive/mermaid/plantuml/analytics）。

**核心问题（已实证）**：① 仅 `setting-utils.ts` 用了 runtime，其余 8 个组件手写读取；② runtime.ts 存在**后台可改但 getter 读不到**的字段缺口（后台改了 → 前端不生效）：

| 后台组 | 缺口字段 |
|---|---|
| `panel` | 13 个开关（wallpaperModeSwitchable/bannerCarouselSwitchable/…） |
| `sidebar` | showProfile/showTags/showCategories/showCalendar/showMusic/showAnnouncement |
| `theme` | homeSubtitles |
| `cover` | showLoading |
| `music` | autoplay |
| `dynamic` | apiUrl, profileUrl |
| `bilibili` | uid |
| `vndb` / `myanimelist` / `bangumi` | username |
| `sponsor` | showButtonInPost, showSponsorsList |
| `announcement` | closable, content |
| `ads` | adSenseId, customCode |
| `pio` | model |

**原则**：runtime getter 需读全对应后台组的字段（`settingsOf`/`groupOf`/`str`/`num`/`bool`/`arr`），静态 config 仅兜底；后台可改 → 前端必生效。

## 3b. 新增/补齐 getter

| Getter | 补齐内容 |
|---|---|
| `getPanelConfig`（新增） | panel 组 13 开关，兜底 `displaySettingsConfig` |
| `getSidebarConfig` | 补 showProfile/showTags/… 开关 |
| `getWallpaperConfig` | 补 `theme.homeSubtitles`，及 `theme.banner`/`theme.fullscreen` 子对象 |
| `getCoverConfig` | 补 `showLoading` |
| `getMusicConfig` | 补 `autoplay` |
| `getDynamicConfig` | 补 `apiUrl`, `profileUrl` |
| `getPioConfig` | 补 `model` |
| `getSponsorConfig` | 补 `showButtonInPost`, `showSponsorsList` |
| `getAnnouncementConfig` | 补 `closable`, `content` |
| `getAdsConfig`（新增） | ads 组 adSenseId/customCode，兜底 `adsConfig` |
| `getNavbarConfig` | 统一 `settings.navbar`（兜底 `siteConfig.navbar`）+ `settings.nav.navItems`（兜底 `navBarConfig.links`） |
| 页面类组 | bilibili/vndb/myanimelist/bangumi 的 uid/username 由各自页面组件统一经 runtime 读取 |

**原则**：`getXxxConfig` 返回完整静态默认 + D1 覆盖；缺失字段保持静态默认；空串/undefined 回退静态默认。每个 getter 有对应 `getXxxConfigFromWindow()`。

## 4. 组件迁移清单

8 个未迁移组件改为调用 runtime getter，删除手写 settings 读取：

| 组件 | 改用 | 涉及字段 |
|---|---|---|
| `src/layouts/Layout.astro` | `getSiteConfig`, `getWallpaperConfig` | title/subtitle/description/hue/siteUrl/favicon/theme.mode/theme.banner 等 |
| `src/layouts/MainGridLayout.astro` | `getWallpaperConfig`, `getSiteConfig`, `getNavbarConfig` | bannerUrl(替换语义)/mobileImages/categoryBar/pages 等 |
| `src/components/layout/WallpaperSection.astro` | `getWallpaperConfig` | overlayOpacity/overlayBlur |
| `src/components/layout/Navbar.astro` | `getWallpaperConfig`, `getNavbarConfig`, `getMusicConfig`, `getPanelConfig` | theme.mode/banner/fullscreen/navbar/panel/music 等 |
| `src/components/layout/SideBar.astro` | `getSiteConfig`, `getMusicConfig` | sidebar/music/dynamic/gallery/friends 页开关 |
| `src/components/layout/Footer.astro` | `getFooterConfig`, `getProfileConfig`, `getSiteConfig` | footer.enable/footer.text/name/author |
| `src/components/layout/HeaderTopRow.astro` | `getNavbarConfig` | nav.enabled |
| `src/pages/posts/[...slug].astro` | `getSiteConfig`, `getProfileConfig`, `getCoverConfig`, `getPostConfig`, `getSponsorConfig`, `getLicenseConfig`, `getCommentConfig` | cover/avatar/siteUrl/bio/post/sponsor/pages/license/comment |

## 5. Bug 修复

### 5.1 背景图替换语义
`MainGridLayout`：用 `getWallpaperConfig(locals).src`（`desktop`/`mobile`），删除"依赖静态默认图非空 + 拼接"逻辑。后台 `bannerUrl` 非空则**整体替换**默认桌面图；为空则回退静态默认。

### 5.2 壁纸模式优先级统一
约定：`localStorage（用户个人偏好） > 后台默认值（全局）`。
- `setting-utils.ts` 的 `getStoredWallpaperMode()`（已实现 `localStorage || runtimeMode`）作为**唯一**决策源
- `Layout.astro` inline script 复用同一函数逻辑，删除各自独立实现，消除两套来源
- `DisplaySettingsIntegrated.svelte` onMount 保留从 localStorage 恢复用户偏好的行为，但**初始渲染**用后台默认值，确保后台改模式在未手动切换用户身上全局生效
- 当 `wallpaperModeSwitchable` 关闭时：忽略 localStorage，恒用后台默认值（现有行为保留）

### 5.3 标题/副标题统一
`Layout.astro` 改用 `getSiteConfig(locals)`：
```js
const sc = getSiteConfig(Astro.locals);
const effectiveTitle = sc.title;
const siteSubtitle = sc.subtitle;
```
消除"title 走嵌套、subtitle 走平铺"的混合路径。runtime 的 `str()` 兜底保证空值回退静态默认。

### 5.4 死字段处理
`fullscreenBg`：本次仅**从 settings-defaults 移除 `n:""` 占位**，避免误导。不接入前后台（超出本次范围，作为后续可选）。如需支持"全屏背景自定义"另行立项。

## 6. 错误处理与兜底

- 所有 runtime getter 保证：D1 缺字段 / 类型错误 / 空字符串 → 静默回退静态默认，不抛异常
- `window.__FIREFLY_SETTINGS__` 未注入（SSR 失败/直开静态页）时 `getXxxConfigFromWindow` 返回纯静态默认
- middleware 合并逻辑（`assignFlat` / `conflictedKeys`）**保持不变**，只改消费端

## 7. 测试与验证

- 复用 `scripts/ui-review.cjs` 跑全站回归（基线 79/81）
- 用 Playwright 断言：前台 `data-wallpaper-mode`、背景图 src（替换语义）、`<title>`（title-subtitle）与后台设置一致
- 手动切换壁纸模式 → localStorage 生效、刷新保留；后台改默认值 → 未切换用户看到新值
- `pnpm build` 确认构建通过；`pnpm typecheck`（如有）通过
- 不重启用户 dev server（PID 56550）；若需验证可在确认后另开端口或请求用户重启

## 8. 范围外（不本次做）

- **方案 B 内容**：不为文档中有而后台无表单的字段补后台 UI（analytics.googleAnalyticsId/la51Analytics、postListLayout.*、imageOptimization.*、bangumi.apiUrl/mode/nsfw、vndb.apiToken 等）
- `admin/AdminSettings.svelte` GROUPS 结构不改
- middleware / API 端点不改
- 生产构建产物验证（`@astrojs/cloudflare` 无法 `astro preview`）
- `fullscreenBg` 功能接入

## 9. 交付物与完成状态

**已完成（方案 A）：**
- `src/config/runtime.ts` 扩展：补齐 getSidebarConfig show*、getCoverConfig.showLoading、getMusicConfig.autoplay/enable、getPioConfig.model、getSponsorConfig.showButtonInPost/showSponsorsList、getDynamicConfig.apiUrl/profileUrl/enable、getAnnouncementConfig.content、getNavbarConfig.enabled/title/widthFull/menuAlign/followTheme/stickyNavbar/logo、getWallpaperConfig.banner/fullscreen 子对象；新增 getPanelConfig；getSiteConfig/getProfileConfig 改为嵌套组优先（修复 conflictedKey title 平铺读不到）
- `MainGridLayout`：背景图改用 getWallpaperConfig 替换语义（修复拼接 bug）
- `Layout`：isWallpaperSwitchable 改读后台 panel 组
- `setting-utils` / `banner-visibility-utils`：panel 开关改读运行时 getPanelConfig
- 组件迁移：MainGridLayout / Footer / WallpaperSection / HeaderTopRow / SideBar / Navbar 统一走 runtime getter
- 壁纸模式优先级（localStorage > 后台默认，wallpaperModeSwitchable 控制）端到端验证通过
- 新增 tests/runtime-config.test.ts（12 用例），全项目 74 测试通过
- `astro check` 0 错误；dev server 回归 79/81（与基线一致，2 个失败为既有问题）

**未做（方案 B 范围外）：**
- 不为后台无表单的文档字段补后台 UI（analytics.googleAnalyticsId/la51Analytics、postListLayout.*、imageOptimization.*、bangumi.apiUrl/mode/nsfw、vndb.apiToken 等）
- `[...slug].astro`（文章页）深度迁移——项目无文章内容无法验证，其读取已能生效
- `fullscreenBg` 功能接入（死字段，仅移除 settings-defaults 占位可另立项）
