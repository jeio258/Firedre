# 配置文件说明

本目录的配置真身在 `shared/config/`（双端中立层，server 与 src 共用）；本目录仅保留：

```
src/config/
├── index.ts            # 配置索引 barrel（值导出全由 @shared/config/runtime getter 派生，统一导出面）
├── runtime.ts          # re-export shim（真身在 shared/config/runtime.ts）
├── FooterConfig.html   # 页脚展示资源（仅 Footer.astro 使用）
└── README.md           # 本文件
```

## 配置单一源（A5 后现状，2026-10-01 落地）

- `shared/config/settings-defaults.ts` 是**默认值唯一源**（29 组，与 `SETTING_GROUPS` 一致）；结构字段（navbar / wallpaperBase / 侧栏组件列表 / 导航模板等）已内嵌其中。
- `shared/config/runtime/*` 提供各 `getXxxConfig(locals)` getter：取值 D1 后台设置 → settingsDefaults，**无静态兜底**；21 个静态配置文件已删除。
- `@/config` barrel 的值导出全部由 getter 以 `defaultsLocals` 派生，消费文件 import 路径零改动。

## 字段一致性（2026-10-02 E-07 复核）

- 后台表单 schema（`src/components/admin/adminSettingsSchema/`）的字段**全部被 defaults 覆盖**（0 个表单独有字段，表单不会渲染 undefined 值）。
- 4 组无表单：announcement / dynamic / friends / gallery——各有专属编辑器（AdminNoticeEditor / AdminDynamic / AdminFriendsEditor / AdminGalleryHub），属设计而非漂移。
- 表单入口现状（2026-10-02 E-07 已补齐）：
  - mermaid / plantuml / expressiveCode 三组的 lightTheme / darkTheme 均已入表单
  - `sponsor.qrCode` 已入表单，但赞助页二维码实际读 `site_links(kind=qr)`，settings 层该字段无消费方（死字段核验项）
- `profile.links` 等 records 字段：defaults 存 JSON 字符串；前台经 `mergeSettings.normalizeSettingValue` 自动解析为数组；admin GET 为裸合并不做解析（字符串透传）——RecordsEditor `toText` 对 JSON 字符串输入有解析分支（展为行文本、保存时序列化回字符串），**已核实兼容**（2026-10-02）。
- `basic.siteUrl` 经 `normalizeSiteUrl` 收敛（`shared/config/runtime/site.ts`）：改此字段的类型/形状须复核该 getter。

## 使用方式

推荐统一导入（导出面不变）：

```ts
import { siteConfig, profileConfig } from "@/config";
```

直接用运行时 getter（服务端 / 自定义场景）：

```ts
import { getSiteConfig, defaultsLocals } from "@shared/config/runtime";
const siteConfig = getSiteConfig(defaultsLocals);
```

## 环境变量

- `PUBLIC_DISPLAY_SETTINGS`（`import.meta.env` 读取，见 `shared/utils/display-settings-utils.ts`）：覆盖视图设置面板启用与否，优先于配置项 `enable`；取值 `true/1/on/yes` 开启，`false/0/off/no` 关闭，无需改配置文件。
