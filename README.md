# Book Shop + Reader（在线书店 + 阅读器）MVP

一个**极简付费电子书店 + Web 沉浸阅读器**：用户浏览书单 → 体验免费试读 → 单本买断解锁 → 书架持有 → 多设备续读并同步进度。

> 仓库路径：`out/engineering/bookshop/`（不要再写 `rd/engineering/workers/service/out/`）。PRD：`out/product/bookshop/prd.md`。

## 技术栈

- **Next.js 14 App Router** + shadcn/ui（Tailwind CSS + Radix UI）+ React 18
- **Supabase**：Postgres（数据 / RLS）、Auth（注册登录 / 重置密码）、Storage（封面 + 正文）
- **Stripe**：Checkout 支付 + webhook（解锁 / 退款）
- **Resend**：欢迎邮件 / 重置密码邮件
- **部署**：Vercel
- 类型安全：TypeScript + Zod（表单/入参服务端校验）
- Server Actions 实现管理端 CRUD

## 目录结构

```
bookshop/
├── app/
│   ├── (marketing)/          # 公开页组：Landing、/books 书单、/books/[slug] 详情、/pricing 等
│   ├── (auth)/               # 认证页组 + 登录/注册/重置 Server Actions
│   ├── (reader)/             # 受保护页组：/reader 书架、/reader/[slug] 阅读器
│   ├── admin/                # 管理后台：概览、图书管理/上架/编辑、订单
│   ├── api/                  # 路由：stripe/checkout、webhook/stripe、reader/progress、books/[slug]/unlock-status、admin/upload-cover
│   ├── auth/callback/        # Auth 回调
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── admin/                # 管理端表单（book-form）
│   ├── auth/ books/ layout/ reader/ ui/
│   ├── reader/reader.tsx     # 阅读器客户端组件（沉浸阅读、进度/字号/主题、付费墙、回跳轮询）
│   └── theme-provider.tsx
├── lib/
│   ├── supabase/             # server（anon+service role）/ browser 客户端
│   ├── data.ts               # 服务端数据访问 + withContentAccess（正文按 purchase 私有）
│   ├── auth.ts               # getCurrentUser / isCurrentUserAdmin
│   ├── payments.ts           # webhook 业务（幂等解锁/退款）
│   ├── stripe.ts             # Checkout Session 创建
│   ├── mail.ts               # Resend 邮件（尽力而为，不阻塞）
│   ├── config.ts             # 集中配置（站点/币种/试读/轮询/字号/admin 判定）
│   ├── trial.ts              # 试读边界计算（前 N 章或前 10%，取较小者）
│   └── types.ts / utils.ts
├── middleware.ts             # 会话刷新 + /reader、/admin 保护
├── supabase/
│   ├── migrations/           # 0001 schema、0002 RLS、0003 storage
│   └── seed/seed.ts          # 公版示例书目种子
├── docs/
│   ├── env.md                # 环境变量清单
│   └── manual-verification-checklist.md  # 手动验收清单（映射全部 AC）
├── .env.example
└── package.json
```

## 本地启动

> 需要 Node 18+ 与 npm。

```bash
# 1) 安装依赖
npm install

# 2) 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，至少填写 Supabase URL + anon key + service role + APP URL

# 3) 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

## 环境变量配置

完整清单与说明见 **`docs/env.md`**。核心变量：

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 项目（必填） |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role（管理 CRUD / webhook，仅服务端） |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe 支付与 webhook |
| `RESEND_API_KEY` / `RESEND_FROM` | 邮件 |
| `NEXT_PUBLIC_APP_URL` | 应用对外 URL（回调 / 邮件 / 支付回跳基准） |
| `ADMIN_EMAILS` | 管理员邮箱白名单（后台权限，逗号分隔） |

> 本地开发放 `.env.local`；部署放 Vercel。敏感变量**不要**加 `NEXT_PUBLIC_` 前缀。

## 数据库（Supabase）

1. 在 [Supabase](https://supabase.com) 建项目，填入 `.env.local`。
2. 应用 migrations：

```bash
# 方式 A：CLI（推荐）
npx supabase db push

# 方式 B：本地 SQL 编辑器粘贴 supabase/migrations/0001..0003 依次执行
```

3. 灌种子（公版示例书目 + 章节）：

```bash
npm run supabase:seed   # = tsx supabase/seed/seed.ts
```

RLS 已由 `0002_rls.sql` 配置：**试读内容公开、正文私有按 purchase**，`reading_progress`/`purchases`/`profiles` 仅本人，管理端写走 service role。

## 部署到 Vercel

```bash
# Vercel CLI（或 dashboard 导入仓库）
npm i -g vercel
vercel
```

在 Vercel 项目 **Settings → Environment Variables** 配置 `docs/env.md` 中全部变量（生产 `NEXT_PUBLIC_APP_URL` 填正式域名）。生产迁移 / seed 在部署前到已建 Supabase 项目执行一次。

## Webhook 配置（Stripe）

- **Endpoint 路由**：`POST /api/webhook/stripe`
- **事件**：需订阅
  - `checkout.session.completed`（解锁，幂等防重）
  - `charge.refunded`（退款基础标记）
  - 其余事件类型 handler 幂等返回 2xx，可安全订阅或忽略（如需可加 `checkout.session.async_payment_failed`）
- **签名**：在 Stripe Dashboard → Developers → Webhooks 添加 endpoint 指向 `https://<your-app>/api/webhook/stripe`，Copy 生成的 `whsec_...` 到 `STRIPE_WEBHOOK_SECRET`。
- 本地联调：

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook/stripe
# 把输出的 whsec_... 填到 STRIPE_WEBHOOK_SECRET
```

## Resend 域名验证（邮件）

1. 在 [Resend](https://resend.com) 添加发信域名（如 `your-domain.com`）。
2. 按 Dashboard 提示配置 SPF (`include:amazonses.com`) 与 DKIM (`_domainkey`) DNS 记录，等状态为 `Verified`。
3. 将 `RESEND_API_KEY`（`re_...`）与 `RESEND_FROM`（如 `BookShop <noreply@your-domain.com>`）写入环境变量。

> 未配置 `RESEND_API_KEY` 时邮件功能会 fail-open（仅日志），不阻塞注册/重置主流程。

## 主要流程

- **浏览 → 试读**：`/books`、`/books/[slug]`，未购用户可读前 N 章（或前 10%，取较小者），其余锁定。
- **购买解锁**：`PurchaseButton` → 未登录先登录保留意图 → `/api/stripe/checkout` 创建 Session → Stripe 支付 → 回跳 `/reader/[slug]` → 阅读器轮询 `unlock-status`（webhook 兜底落库）。
- **阅读器**：章节导航（下拉/上一章下一章/键盘 ←→）、字号 A-/A+、深色/护眼主题、进度云同步（防抖 800ms）、付费墙。
- **书架**（`/reader`）：阅读中 / 未读 / 已读完分栏，进度条 + 继续阅读。
- **后台管理**（`/admin`）：上架/编辑/下架图书、上传封面、设置试读阈值、查看订单。

## 交付物 / 验收

- 手动验收清单：`docs/manual-verification-checklist.md`
- 环境变量清单：`docs/env.md`
- PRD §8 AC 需外部服务（Stripe/Supabase/Resend）的项目在清单中已标注 **[外部]**，其余 **[代码]** 项可本地直接验证。
