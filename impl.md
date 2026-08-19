# 验收缺陷修复记录（product-accept → CONDITIONAL-PASS）

## 运维 backlog 修复记录（operation 静态回归 → ❌→✅ 修复项）

> 依据运维域静态回归清单在 `out/engineering/bookshop/` 上的修复（工作目录同）。
> 本段追加于 `impl.md` 顶部（任务要求）。本地已具备 node_modules，typecheck / 生产构建 / 配置加载均本地复验通过。

| item# | 改动文件 | 修复方式 | 本地可复验 |
|-------|----------|----------|------------|
| ⚙运维-1（build/dev 阻塞） | `next.config.mjs` | `.mjs` 为 ESM 却用 CJS `module.exports=nextConfig`，Node 25 ESM strict 下 Next CLI 加载 config 抛 `ReferenceError: module is not defined`，阻塞 build/dev/lint。已改为 `export default nextConfig;`（同文件 header 安全加固逻辑未动）。 | ✅ `node -e "import('./next.config.mjs')..."` 加载 OK；`npx next build` 全量成功（exit 0） |
| ⚙运维-1b（build 阻塞·同类） | `postcss.config.mjs` | 与 next.config 同源缺陷：`.mjs`(ESM) 却用 `module.exports`，`next build` 在 postcss 加载阶段抛同一 `ReferenceError`（仅在修完 next.config 后才暴露）。同法改 `export default {...}`。 | ✅ `node -e "import('./postcss.config.mjs')..."` 加载 OK；`npx next build` 全量成功（exit 0） |
| ⚙运维-2（typecheck，10 错） | `lib/supabase/server.ts` `setAll`、`middleware.ts` `setAll` | `@supabase/ssr@0.5.1` 的 `SetAllCookies` 形参未标注，实参隐含 any（server.ts 4 错 + middleware.ts 6 错）。给两个 `setAll(cookiesToSet)` 加显式形参 `Parameters<SetAllCookies>[0]`（对齐官方 `CookieMethodsServer.setAll?: SetAllCookies` 签名），并 `import type { SetAllCookies, CookieOptions } from '@supabase/ssr'`；`cookieStore.set(name,value,options as CookieOptions)` 显式化 options。另删 `app/layout.tsx` L25 已失效的 `@ts-expect-error`（TS 5.6/React 18 使 async Server Component 直接可用，该指令现报「unused」）。`getAll()` 返回类型由上下文推断为 `{name,value}[]`，无 any。 | ✅ `npx tsc --noEmit` exit 0（原 10 impl-any + 1 unused-ts-expect-error 全清零） |
| ⚙运维-3（npm audit） | 无（见「结论」列） | ⚠️ **真实根因核查**：`glob@10.5.0` 实测**未被弃用**（其 package.json 无 `deprecated` 字段）且**未被 audit 标记**（`npm audit` 仅 flag `next` 与 `postcss`）。当前 2 high = `next@14.2.15`（多 CVE，修复要求 `>=15.5.21`）+ 其传递依赖 `postcss<=8.5.22`（`npm audit fix --force` 会装 `next@16.3.1` 属 breaking）。`glob` 只是 `resend→@react-email/render→js-beautify` 的普通依赖，非根因。**结论：audit 无法在不做 breaking major（Next 14→15.5.21+/16 + React 18→19 + `cookies()` 同步改异步的全局迁移）的情况下清零**；该迁移超出本 backlog 修复范围且有打破当前绿色构建的风险，建议另开「Next.js 15/React 19 升级」专项任务。 | ❌ 无法本地清零（需 major 迁移）；验收路径：新专项升级后跑 `npm audit` 应 high=0。glob 本身无安全项可修。 |

> ⚙运维-1/1b/2 均本地复验通过（`tsc --noEmit` + `npx next build` exit 0）。
> ⚙运维-3 与任务清单所述根因不符：修复对象应是 `next@14.2.15`+`postcss` 而非 `glob`；已如实记录并给出专项升级路径。

> 依据 `rd/product/workers/accept/out/bookshop-acceptance.md` 的缺陷清单修复。
> 本段追加于 `impl.md` 顶部（任务要求）。涉及文件均位于 `out/engineering/bookshop/`。
> 判 CONDITIONAL-PASS 时的产品侧核验基于「预修复快照」——缺陷 #1/#2 在工程侧
> `bookshop_fix`（review.md §六 / fix-summary.md）中已实现，本次逐条复验并补齐 #3–#6。

| # | 严重度 | 改动文件 | 修复方式 | 本地可复验 |
|---|--------|----------|----------|------------|
| ⚙运维-1 | 高（建库前） | `supabase/migrations/0003_storage.sql` L14 | 运维联调发现：`book-content` bucket `allowed_mime_types` 含非法 MIME `'application/json encoding=utf-8'`，Supabase Storage 会拒绝。已改为 `'application/json'`（`covers` bucket 的 `image/*` 列表本就合法）。 | ✅ 放行 H1 建 Supabase 测试项目后即可验：`book-content` 可上传 `application/json` |
| 1 | 中（发布阻断） | `components/reader/reader.tsx`（`currentPercentThunk`/`computePercent`/`maybeSave`/`persist`） | 复验已落地：percent 改为「章节维度 base + 激活段落段内偏移」，clamp 0–100，无 `/0`（`totalChapters<=0` 早退返回 0）。滚动 `maybeSave` 写入真实百分比，不再是恒定 100。`goTo` 切章用同源 `computePercent`。 | ✅ 本地：滚动阅读后查 `reading_progress.percent` 非 100；书架「已读完」不再误标。 |
| 2 | 中（发布阻断） | `components/reader/reader.tsx`（`offlinePendingSave` ref + `addEventListener('online')`） | 复验已落地：`persist` 失败时把待同步 payload 存入 `offlinePendingSave` 离线缓冲；`window` `online` 事件触发时自动 flush POST 同步，成功清空缓冲。覆盖 AC-R8。 | ✅ 本地：DevTools「断网」读+停止 → 恢复网络后自动 sync，缓冲清空。 |
| 3 | 中/低（建议） | `app/(marketing)/books/[slug]/page.tsx`、`components/books/purchase-button.tsx` | 详情页读取 `searchParams.buy`（登录回跳保留的意图 `next=/books/[slug]?buy=[id]`），传入 `PurchaseButton autoTrigger`；组件挂载时若 `?buy===bookId` 自动 `handleClick()` 续进 Stripe Checkout，保住「购买→阅读」流畅。意图不丢（未登录仍回 login 保留 next）。 | ✅ 本地：未登录点解锁 → 登录回跳后自动进入 `/api/stripe/checkout` 重定向（Stripe 真实跳转需外部）。 |
| 4 | 低（迭代） | `tailwind.config.ts`、`components/books/book-grid.tsx`、`app/(reader)/reader/page.tsx` | 新增 `screens.bp480=480px`/`bp780=780px`，书单网格与书架网格改 `bp480:grid-cols-2 bp780:grid-cols-3`，对齐 AC-N4/L3「3→2→1 列（780/480）」。默认不再少于 480px 才 1 列（`grid-cols-1` 兜底）。 | ✅ 本地：切换视口宽度 480/780 观察列数 1→2→3。 |
| 5 | 低（迭代） | `app/admin/actions.ts`（`buildChapters` + `createBook`） | `buildChapters` 现接受 `{trialChapters,trialPercent}`，`createBook` 把表单配置传入；`is_trial` 委托 `lib/trial.isTrialChapter`（按 count 与 percent，取较小者），与运行时边界完全一致，不再硬编码前 2 章。 | ✅ 本地：以 `trial_chapters=1, trial_percent=10`（12 章书）粘贴正文，落库首章 `is_trial=true`、其余 false。 |
| 6 | 低（迭代） | `app/(marketing)/books/loading.tsx`+`error.tsx`、`app/(marketing)/books/[slug]/loading.tsx`+`error.tsx`、`app/(reader)/reader/loading.tsx`+`error.tsx`、`app/(reader)/reader/[slug]/loading.tsx`+`error.tsx` | 新增 4 组路由级 `loading.tsx`（复用 `components/ui/skeleton.tsx`，骨架屏接线）与 `error.tsx`（客户端边界，含 `reset` 重试 + 阅读器「返回书架」逃生）。覆盖 AC-N5 三态之加载/错误可重试。 | ✅ 本地：挂一个慢/失败的数据源即可触发骨架屏与重试 UI。 |

验证方式：本 worker 仅做静态复验（无 node_modules，无法本地 `tsc`/`next build`）；上表「本地可复验」为脚手架手动验证路径。外部联调（Stripe/Resend/Supabase/性能）仍归运维。

---

# Book Shop + Reader MVP — 落地摘要

- **task_id**: `bookshop_mvp`
- **status**: `PASS`
- **域 / worker**: engineering / service（`ds-engineering-service`）
- **日期**: 2026-08-19
- **模式**: 续跑 · 补齐 Book Shop + Reader MVP 剩余缺口（A/B/C/D）

---

## Summary

在既有骨架上补齐了 Book Shop + Reader MVP 的四大剩余缺口，全部落于
`out/engineering/bookshop/`：

- **缺口 A — Reader 核心 server page**：新增 `app/(reader)/reader/[slug]/page.tsx`。按 slug 加载 book（可为任意状态，使**已购用户在下架/归档后仍可阅读**，满足 AC-M3/AC-B3；未购非 published 走 404）+ 全部章节 +
  `withContentAccess`（正文私有按 purchase 的防深线）应用内容访问 + 当前用户 purchase 状态 + reading_progress，
  对齐已完成的 591 行客户端 `Reader` 组件 props，支持回跳解锁轮询入参（`?session_id`）与试读意图（`?trial=1`）。
  遵循 PRD §8.5 AC-R1~R9 与 §6 RLS 边界；最终防线由 migrations 0002 的 chapters RLS（试读公开、正文按 purchase）
  保证（AC-N1）。未登录访问由既有 middleware.ts 拦截保留回跳。

- **缺口 B — Admin CRUD**：补齐 `/admin` 概览页（AC-M1 权限校验 + 数据统计）、图书列表（含 draft/archived 全量 +
  上架/下架 action）、上架表单（slug/标题/作者/分类/价格/币种/封面上传 Storage/试读阈值/正文）、编辑页、
  只读订单视图（AC-M4）、`app/admin/actions.ts` 服务端 CRUD（createBook/updateBook/publishBook/unpublishBook，
  每个 action 服务端重校验 ADMIN_EMAILS 权限）、`components/admin/book-form.tsx` 复用表单组件、以及
  `app/api/admin/upload-cover/route.ts`（封面上传到 `covers` bucket，服务端校验管理员）。Writes 走 service-role client
  （绕过 RLS，与 migrations 0002 所述 admin/svc 写入一致）；优先级：下架后前台不可见、已购用户仍可读（AC-B3 / AC-M3）。

- **缺口 C — 文档交付物**：`docs/env.md`（PRD §9.2 全部变量 + 敏感标识/组合说明）、
  `docs/manual-verification-checklist.md`（**逐条映射 AC-L1~L6 / A1~A5 / B1~B3 / P1~P7 / R1~R9 / E1~E3 / M1~M4 / N1~N5**，
  每条 Given/When/Then 或可勾选步骤，并标注 **[代码]**（脚手架可验证）与 **[外部]**（依赖 Stripe/Supabase/Resend 需部署联调））、
  根 `README.md`（简介/技术栈/目录结构/本地启动/env 配置/migration/seed/Vercel 部署/webhook 配置/Resend 域名验证，中文）、
  根 `.env.example`（占位符）。

- **缺口 D — 摘要**：本文件（task_id=bookshop_mvp，status=PASS）。

不重写任何已存在且被确认可用的文件；未写真实密钥；未合并不部署（本 worker 不承担部署）。

---

## Artifact Paths

所有路径为真实存在文件：

**本次新增（缺口 A/B/C）**
- `out/engineering/bookshop/app/(reader)/reader/[slug]/page.tsx`
- `out/engineering/bookshop/app/admin/page.tsx`
- `out/engineering/bookshop/app/admin/layout.tsx`
- `out/engineering/bookshop/app/admin/actions.ts`
- `out/engineering/bookshop/app/admin/books/page.tsx`
- `out/engineering/bookshop/app/admin/books/new/page.tsx`
- `out/engineering/bookshop/app/admin/books/[id]/edit/page.tsx`
- `out/engineering/bookshop/app/admin/purchases/page.tsx`
- `out/engineering/bookshop/app/api/admin/upload-cover/route.ts`
- `out/engineering/bookshop/components/admin/book-form.tsx`
- `out/engineering/bookshop/docs/env.md`
- `out/engineering/bookshop/docs/manual-verification-checklist.md`
- `out/engineering/bookshop/README.md`
- `out/engineering/bookshop/.env.example`
- `out/engineering/bookshop/impl.md` 本摘要

**已有且被沿用（未改动，供上下文引用）**
- `out/engineering/bookshop/components/reader/reader.tsx`（591 行客户端 Reader）
- `out/engineering/bookshop/middleware.ts`（/reader、/admin 保护 + 回跳）
- `out/engineering/bookshop/lib/data.ts`（listChapters / withContentAccess）
- `out/engineering/bookshop/lib/payments.ts`、`lib/stripe.ts`、`lib/mail.ts`、`lib/config.ts`、`lib/types.ts`
- `out/engineering/bookshop/supabase/migrations/0001_schema_tables.sql`、`0002_rls.sql`、`0003_storage.sql`
- `out/engineering/bookshop/supabase/seed/seed.ts`
- `out/engineering/bookshop/app/api/books/[slug]/unlock-status/route.ts`、`app/api/reader/progress/route.ts`、`app/api/stripe/checkout/route.ts`、`app/api/webhook/stripe/route.ts`

---

## 验收提示（外部依赖标注）

见 `docs/manual-verification-checklist.md`。以下 AC 依赖真实外部服务，需部署后联调，当前为脚手架可验证项：
- **Stripe**：AC-P2~P7（Checkout/回跳/幂等/签名/重复支付）
- **Resend**：AC-A2/A4、AC-E1/E2（欢迎/重置邮件送达，需域名验证）
- **Supabase**：AC-B3/M2/M3/N1（RLS 正文私有、Storage 上传、下架可见性）— 本地若已配置项目即可验证
- 其余标 **[代码]** 条目可在本地脚手架直接手动验证。

## Metrics

- `duration_sec`: 2100
- `model`: deepseek/deepseek-chat
