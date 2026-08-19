# 环境变量清单（ENV）

> Book Shop + Reader MVP 所需全部环境变量。按 PRD §9.2 及工程实际引用整理。
> 所有敏感值均以占位符示例，请勿写入真实密钥。Secret 类变量 **不应进入 `NEXT_PUBLIC_` 前缀**（避免打进前端 bundle）。
> 本地开发放 `.env.local`（不会被 Git 跟踪）；部署到 Vercel 时在 Project → Settings → Environment Variables 配置。

| 变量名 | 用途 | 示例 / 必填 | 敏感 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL（https://<project>.supabase.co） | `https://xyz.supabase.co` · **必填** | 否（公开可读） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 key（走 RLS，浏览器/服务端客户端用） | `eyJ...anon` · **必填** | 否（公开可读） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key（**绕过 RLS**，仅后台/服务端 webhook 用，绝不下发前端） | `eyJ...service_role` · 生产**必填**，本地联调 webhook/管理 CRUD 需要 | **是** |
| `STRIPE_SECRET_KEY` | Stripe 服务端密钥（Checkout session 创建；webhook handler 用） | `sk_test_...` · **必填**（支付联调） | **是** |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook 签名校验 secret（`whsec_...`） | `whsec_...` · 生产 webhook **必填** | **是** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 可发布 key（前端；本 MVP 主要用服务端密钥，此为备用） | `pk_test_...` · 可选 | 否（公开可读） |
| `RESEND_API_KEY` | Resend 发信 API key（欢迎邮件 / 重置密码邮件） | `re_...` · 邮件联调时需要 | **是** |
| `RESEND_FROM` | 发信人地址（需在 Resend domain 已验证） | `BookShop <onboarding@your-domain.com>` · 默认 `onboarding@resend.dev` | 否 |
| `NEXT_PUBLIC_APP_URL` | 应用对外 URL（Stripe success/cancel、Auth 回调、邮件链接的基本地址） | 本地 `http://localhost:3000`；生产 `https://your-app.vercel.app` · **必填**（支付/邮件） | 否 |
| `NEXT_PUBLIC_CURRENCY` | 结算币种（默认 `usd`，PRD Q1） | `usd` · 可选（默认 usd） | 否 |
| `ADMIN_EMAILS` | 管理员邮箱白名单（逗号分隔）—— 后台权限判定（middleware + 服务端 Action + `is_admin()` 语义） | `admin@example.com,owner@example.com` · 后台可用时**必填** | 否 |

---

## 组合说明（按用途）

| 场景 | 需要的变量 |
|---|---|
| 基础页面 / 书单 / 试读 / 认证（本地） | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_APP_URL` |
| 后台管理（CRUD / 封面上传） | 上述 + `SUPABASE_SERVICE_ROLE_KEY` + `ADMIN_EMAILS` |
| 支付闭环（Checkout + webhook 解锁） | 上述 + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| 邮件（欢迎 / 重置） | `RESEND_API_KEY`、`RESEND_FROM`、`NEXT_PUBLIC_APP_URL` |

> 本地联调 webhook（Stripe CLI）：`stripe listen --forward-to localhost:3000/api/webhook/stripe` 并提供对应 `whsec_` 到 `STRIPE_WEBHOOK_SECRET`。

---

## ⚠️ 安全提示

- `SUPABASE_SERVICE_ROLE_KEY`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`RESEND_API_KEY` 均为**敏感**，禁止以 `NEXT_PUBLIC_` 前缀暴露，否则会打进浏览器 bundle。
- 生产环境务必在 Vercel 中分别配置，且 `ADMIN_EMAILS` 只填真实管理员。
- `.env.example` 仅含占位符，不应含真实密钥。
