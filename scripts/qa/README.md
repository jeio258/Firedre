# scripts/qa 说明

共享库 `lib.mjs`（launchBrowser / login / startPreview 等）被本目录多数脚本及 `tests/sanitize-html.test.ts` 引用。
注意：`pnpm check` / `pnpm build` 不自动执行本目录脚本，门禁性质的脚本需手动或 CI 触发。

## 门禁（基线比对 / 冒烟，手动或 CI 触发）

- `biome-baseline.mjs`：biome 存量诊断冻结，新增诊断失败。用法 `node scripts/qa/biome-baseline.mjs [--update]`（--update 重新生成基线）
- `nocheck-baseline.mjs`：@ts-nocheck 文件数与 as any 次数只减不增。用法 `pnpm qa:baseline`
- `stale-class-refs.mjs`：字符串类选择器必须在样式语料有定义。用法 `pnpm qa:stale`
- `render-smoke.mjs`：build 后 SSR 渲染冒烟（路由 200 + 关键元素 + wrangler 无 ERROR）。用法 `pnpm build` 后 `node scripts/qa/render-smoke.mjs [port]`，失败退出码 1

## 回归（按需手跑，`<base>` 默认本地预览/dev 地址）

- `admin-audit.mjs`：/admin 视觉/UX/IA/响应式/可访问性审计；`--suite=settings` 仅枚举设置页分类与组别（原 admin-settings-audit 并入）。用法 `node scripts/qa/admin-audit.mjs <base> [--suite=settings]`
- `admin-crud.mjs`：后台写入路径 E2E（保存/编辑/删除真实往返）。用法 `pnpm qa:admin`
- `admin-probe.mjs`：/admin 无障碍精确探针（hydrate 等待 + 3 断点）。用法 `node scripts/qa/admin-probe.mjs <base>`
- `contrast-pixel.mjs`：截图像素级 WCAG 对比度门禁（覆盖壁纸/背景图盲区）。用法 `pnpm qa:contrast [baseUrl] [outJson]`
- `full-audit.mjs`：全功能无头审计（页面/API 正负用例/交互/静态资源）。用法 `node scripts/qa/full-audit.mjs <base>`
- `heal-verify.mjs`：自愈重载验证（正常页不重载，断 CSS 恰重载 1 次）。用法 `node scripts/qa/heal-verify.mjs <base>`
- `live-audit.mjs`：CDP 驱动真实 Chrome 全站访问测试；--prod 对线上域名只读采样（原 live-prod-audit 并入）
- `panel.mjs`：显示设置面板交互矩阵与基线比对。用法 `pnpm qa:panel`（`--update` 刷新基线）
- `site-audit.mjs`：移动/桌面交互与可访问性排查。用法 `pnpm qa:site <base> [--json out]`
- `stress.mjs`：多轮压力测试。用法 `node scripts/qa/stress.mjs <base> <分钟数>`，或 `ROUNDS=<n>` 按轮数
- `style-snapshot.mjs`：计算样式指纹，证明 CSS 改动视觉零差异。用法 `node scripts/qa/style-snapshot.mjs <base> [--baseline]`
- `swup-listeners.mjs`：软导航下全局监听器不变式 + 面板矩阵。用法 `pnpm qa:swup`
- `visual.mjs`：首屏几何 + 全页像素哈希视觉门禁。用法 `pnpm qa:visual <base> [--baseline]`
- `flatten-snapshot.ts`：输出展平设置默认值快照供核对。用法 `npx tsx scripts/qa/flatten-snapshot.ts [out]`
