# Book Shop + Reader MVP — 手动验证清单（Manual Verification Checklist）

> 供 `ds-product-accept` 执行。逐条映射 PRD §8 全部 AC。
> 标注：**[代码]** = 当前脚手架即可手动/在本地验证；**[外部]** = 依赖 Stripe/Supabase/Resend 真实服务，需部署后联调。

---

## 前置准备

- [ ] 已按 `README.md` 本地启动（`npm install && npm run dev`），或已部署到 Vercel。
- [ ] `docs/env.md` 全部所需变量已配置（`.env.local` / Vercel）。
- [ ] Supabase 项目已建，migrations 0001/0002/0003 已应用（`npx supabase db push`）。
- [ ] 已跑 seed（`npx tsx supabase/seed/seed.ts`）灌入公版示例书目。
- [ ] `ADMIN_EMAILS` 已包含测试管理员邮箱。
- [ ] （联调外部）Stripe Test 密钥、webhook secret、Resend key + 已验证域名已配置。

---

## AC-L — 公开页

- [ ] **AC-L1** 打开 `/`：可见主 CTA（浏览书库 / 定价等），点击每个 CTA 均能到达可达后续节点（无死链）。**[代码]**
- [ ] **AC-L2** Header 中 Books / Pricing 链接在主要页面（首页、书单、详情、书架、阅读器）可达；登录前显示「登录/注册」，登录后显示「我的书架」。**[代码]**
- [ ] **AC-L3** `/books`：在 ≥780px 宽屏为 3 列、中屏 2 列、<480px 为 1 列；含分类过滤、价格过滤（免费/付费/已购）、搜索。**[代码]**（已按 AC 断点 bp780/bp480 接线，本地切视口宽度可验）
- [ ] **AC-L4** 书单卡片正确显示状态徽标：「已购 ✓」（已购用户）/「试读」（有价格）或「免费」（price=0）。**[代码]**
- [ ] **AC-L5** `/books/[slug]` 详情：封面、作者、分类、简介（可展开）、章节目录（试读章节可预览 + 其余锁定 🔒）；按状态显示按钮（试读第一章 / 解锁 ¥xx / 已购·开始阅读）。**[代码]**
- [ ] **AC-L6** `/pricing`：显示单本定价、FAQ、退款摘要；价格与书籍详情/付费墙数据源一致（均来自 `books.price_cents`）。**[代码]**

## AC-A — 认证

- [ ] **AC-A1** 未登录访问 `/reader`（或 `/reader/alice-in-wonderland`）→ 重定向到 `/login?next=...`；登录后回跳原目标。**[代码]**
- [ ] **AC-A2** Given 合法邮箱密码，When 提交注册，Then 创建账号、跳转 `/books` 或 `/reader`，且发送欢迎邮件（本地无 Resend key 时仅日志，不阻塞）。**[代码]**（**[外部]**: 收到欢迎邮件需 Resend） 
- [ ] **AC-A3** Given 合法凭据，When 登录，Then 进入受保护页并保持会话（刷新不丢登录）。**[代码]**
- [ ] **AC-A4** Given 已注册邮箱，When 发起忘记密码，Then 收到重置邮件并可点击 token 链接重置密码。**[代码]**（**[外部]**: 邮件送达需 Resend）
- [ ] **AC-A5** Given 错误表单（空邮箱/密码<8位/两次不一致），When 提交，Then 内联错误提示可见、提交按钮 loading 防重复。**[代码]**

## AC-B — 书单与详情

- [ ] **AC-B1** Given 某书已购用户，When 打开该书卡片/详情，Then 显示「开始阅读」且无购买入口。**[代码]**
- [ ] **AC-B2** Given 未购用户，When 打开详情，Then 可体验试读（前 N 章/前 10% 取较小者），其余章节锁定。**[代码]**
- [ ] **AC-B3** Given 状态为 draft/下架的某书，When 以游客/普通用户浏览 `/books`，Then 前台不可见（只展示 published）。**[代码]**

## AC-P — 购买与解锁（Stripe）

- [ ] **AC-P1** 未登录点击「解锁/购买」→ 引导登录并保留意图（`next=/books/[slug]?buy=bookId`），登录后回到该书并可直接进入 Checkout。**[代码]**（详情页现解析 `?buy` 并自动触发 Checkout；就近登录回跳可本地验）
- [ ] **AC-P2** Given 登录且某书未购，When 发起 Checkout 并支付成功（用 Stripe Test 卡 4242…），Then 回跳到 `/reader/[slug]` 且在回跳内自动解锁。**[外部 — Stripe]**
- [ ] **AC-P3** Given webhook `checkout.session.completed` 事件，When 处理，Then `purchases.status=paid`；同一 event 重放不二次生效（幂等，`stripe_event_id` UNIQUE）。**[外部 — Stripe]**
- [ ] **AC-P4** Given 回跳先于 webhook 落库，When 进入阅读器，Then 显示「解锁生效中…」并自动重查（5s 内 2–3 次），超时给「稍后重试 / 查看我的书架」。**[外部 — Stripe 时序]**
- [ ] **AC-P5** Given 取消支付，When 回跳，Then 回到书籍详情、保留选择、不产生已购状态。**[外部 — Stripe]**
- [ ] **AC-P6** Given 无有效签名的伪造 webhook 请求，When POST 到 `/api/webhook/stripe`，Then 被拒绝（4xx）且不改变任何状态。**[外部 — Stripe / 可本地用 curl 验证]**
- [ ] **AC-P7** 已购书重复支付：Given 已购，When 再发起购买，Then 不产生重复计费/重复标记（前端不露购买入口 + `/api/stripe/checkout` 服务端校验 409）。**[外部 — Stripe]**（入口隐藏/前端抑制可本地验证 **[代码]**）

## AC-R — 阅读器与进度

- [ ] **AC-R1** Given 已购用户进入 `/reader/[slug]`，Then 全章节可读、章节列表无锁、正文经 RLS 授权可见。**[代码]**（正文 RLS 最终防线在 Supabase，本地若配置 RLS 可验证）
- [ ] **AC-R2** 字号 A-/A+：Given 调整字号 16–24，When 刷新/重进页面，Then 字号恢复；行高 ≥1.6、正文 ≤720px。**[代码]**
- [ ] **AC-R3** 进度保存：Given 滚动阅读/翻章，When 停止（防抖 800ms），Then 进度写入，顶栏显示「已保存」（登录态）；`percent` 为真实百分比（非恒定 100）。**[代码]**
- [ ] **AC-R4** 进度恢复：Given 二次进入同一书，Then 恢复到上次章节+段落锚点，并提示「上次读到 XX」。**[代码]**
- [ ] **AC-R5** 切章：Given 点击上一章/下一章/下拉选章或键盘 ←/→，When 切换，Then 先记录进度再跳转，正确抵达目标章。**[代码]**
- [ ] **AC-R6** 状态标记：Given 章节被读完，Then 在章节下拉中该章标为「✓ 已读」；当前章「·」、后续「未读」（图标区分）。**[代码]**
- [ ] **AC-R7** Given 未购达到试读上限，Then 显示内联付费墙（试读结束说明 + 剩余 N 章 + 已读 X% + 解锁/查看价格；不阻断顶部导航回书架；不重复弹出）。**[代码]**
- [ ] **AC-R8** 断网：Given 离线读某章，When 网络恢复，Then 暂存进度同步成功（`offlinePendingSave` 缓冲 + `online` 监听自动 flush）。**[代码 — DevTools 断网模拟]**
- [ ] **AC-R9** 深色/护眼：Given 开启设置，When 切换，Then 主题即时生效并持久化（localStorage，重进恢复）。**[代码]**

## AC-E — 邮件

- [ ] **AC-E1** Given 注册成功，Then 收到欢迎邮件且「开始阅读」链接可达（需真实 Resend 域名验证）。**[外部 — Resend]**
- [ ] **AC-E2** Given 发起重置，Then 收到含安全 token 的重置邮件，token 可校验使用。**[外部 — Resend]**
- [ ] **AC-E3** Given 邮件服务异常（或未配置 key），When 注册主流程，Then 不阻塞用户进入书籍（`sendWelcomeEmail` 尽力而为，fail-open + 日志）。**[代码]**

## AC-M — 后台管理

- [ ] **AC-M1** Given 非管理用户，When 访问 `/admin`（或直接 `/admin/books`），Then 被拒绝（middleware 重定向到 `/books` + 页面/Server Action 双重校验）。**[代码]**
- [ ] **AC-M2** Given 管理员，When 上架/编辑书（slug/标题/作者/分类/价格/封面上传 Storage/试读阈值/正文），Then 前台即时反映（已发布即在 `/books` 可见）；粘贴正文导入的试读阈值尊重试读章数与百分比（取较小者）。**[代码]**（封面上传依赖 Supabase Storage，**[外部 — Supabase]**）
- [ ] **AC-M3** Given 管理员，When 下架某书，Then 前台不再展示；已购用户已购内容不受影响（仍可从书架阅读）。**[代码]**（已购可读依赖 RLS purchases，**[外部 — Supabase]**）
- [ ] **AC-M4** 可查看 purchases 记录（只读视图，展示 书籍/金额/状态/时间）。**[代码]**（有真实订单需 Stripe，**[外部]**）

## AC-N — 非功能

- [ ] **AC-N1** 安全：未登录调用 `/api/reader/progress`/`/api/stripe/checkout`/`/api/books/[slug]/unlock-status` 返回 401；非管理访问 `/admin/*` 及 Server Action 返回拒绝；RLS 生效（正文越权读不到）。**[代码]**（RLS 最终防线在 Supabase，**[外部 — Supabase]**）
- [ ] **AC-N2** 性能：Landing/书单/详情 SSR 首屏可感知快速（无长阻塞）；阅读器正文加载流畅，翻章无明显卡顿。**[代码 — Lighthouse / 手动]**
- [ ] **AC-N3** 可访问性：正文高对比度达标（≥4.5:1）；全键盘可达、焦点可见（--ring）；form label 关联；图标有 text/`aria-label`；`prefers-reduced-motion` 生效。**[代码]**
- [ ] **AC-N4** 响应式：书单 3→2→1 列断点正确（bp780=780px / bp480=480px）；阅读器正文单栏 ≤720px。**[代码]**
- [ ] **AC-N5** 三态：书单/详情/书架/阅读器在加载/空/错误时分别有对应 UI（loading 骨架屏 `components/ui/skeleton.tsx` 已接线 + 路由级 `loading.tsx`/`error.tsx`，错误可重试），无白屏。**[代码]**

---

## 外部服务矩阵（需部署后联调）

| AC | 依赖 | 说明 |
|---|---|---|
| AC-A2/E1, AC-A4/E2 | **Resend**（+域名验证） | 真实邮件送达 |
| AC-P2~P5, P7 | **Stripe Checkout + webhook** | 真实支付/回跳/幂等 |
| AC-P6 | **Stripe webhook secret** | 签名校验拒绝伪造 |
| AC-B3/M2/M3/N1 (RLS/Storage) | **Supabase**（已配置项目 + RLS 生效 + Storage bucket） | 正文私有按 purchase、封面上传、下架可见性 |
| AC-M4 | **Stripe**（有真实订单后） | 空数据时仅验证空态 |
| AC-N1 (RLS) | **Supabase RLS** | 越权正文读取需在真实项目验证 |

> 其余标 **[代码]** 的条目不依赖外部付费服务，可在本地脚手架（含 Supabase 本地 CLI 或已配置项目）直接手动验证。
