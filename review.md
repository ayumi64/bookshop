# Book Shop + Reader MVP — 工程审查意见

- **task_id**: `bookshop_review`
- **审查方**: engineering / check（`ds-engineering-check`）
- **日期**: 2026-08-19
- **审查对象**: `out/engineering/bookshop/`（实现产物，Next.js App Router + Supabase + Stripe + Resend）
- **结论**: **有条件通过** —— 架构与安全边界正确、付费闭环实现扎实；但存在 **1 个 P0（阅读器运行时崩溃，阻断核心功能）** 与 **多个 P1/P2 功能缺陷**，修复并复核前不建议进入产品验收。

---

## 一、结论总览

| 严重度 | 数量 | 处理 |
|---|---|---|
| P0 | 1 | 必须修复（阅读器无法渲染） |
| P1 | 3 | 应修复（进度分类错误、解锁后空白、断网不同步） |
| P2 | 若干（见下） | 建议改进 |

审查覆盖：RLS 安全边界、付费闭环（Checkout/webhook）、阅读器与进度、后台管理、可运行性静态校验、文档交付物。

---

## 二、确认通过项（静态可验）

- **RLS 安全边界（强）**：migrations/0002_rls.sql 正确落实「试读内容公开、章节正文按 purchase 私有」，正文私有策略关联 `purchases.status='paid'`；purchases 仅本人可见/插入、用户不可改 status/amount；reading_progress/profiles 仅本人。service-role 用于 webhook 与后台写入（绕过 RLS 合理）。达到 AC-N1 的 RLS 防线。
- **Webhook 签名与幂等（强）**：`STRIPE_WEBHOOK_SECRET` 签名校验失败返 400；`stripe_event_id` UNIQUE + 查询去重实现事件幂等；`(user_id, book_id)` UNIQUE 防重复授权。AC-P3/P6/P7 满足（AC-P6/P7 需真实部署实测签名）。
- **退款基础（ACK）**：`charge.refunded` → payment_intent 对账 → 标记 refunded，事件幂等。
- **Checkout 守卫（ACK）**：未登录返 401（AC-P1）；服务端二次重复购买守卫（AC-P7）；非 published 拒 409。
- **内容访问双层**：`withContentAccess`（应用层未购不渲染正文）+ RLS（DB 层）双防线，符合 PRD §6/AC-N1。
- **goTo 章节切换保存（ACK，AC-R5）**：清除防抖、立即持久化到目标章、正确 percent（用 computePercent 而非 buggy thunk）。
- **Admin 权限（ACK，AC-M1）**：`ADMIN_EMAILS` 白名单在 middleware + 服务端 Action + 封面上传 API 三层校验。
- **文档交付物（ACK）**：docs/env.md（PRD §9.2 全部变量 + 敏感标注 + 组合说明）、manual-verification-checklist.md（覆盖 AC-L/A/B/P/R/E/M/N 共 44 处引用，区分 [代码]/[外部]）、README、.env.example。

---

## 三、问题项

### P0-1 · 阅读器运行时崩溃（阻断）
- **文件**: `components/reader/reader.tsx` 行 70-71
- **问题**: `const isTrialHash = useMemo(() => new Set(o => {...})(0), ...)` —— `new Set(...)(0)` 把 Set 实例当函数调用，运行时抛 `TypeError`。该表达式位于 `useMemo` 工厂内，**每次渲染都会执行并抛错** → 整个 `<Reader>` 组件挂载即崩溃（空白页/error boundary）。
- **影响**: 阻断阅读器全部功能（AC-R1~R9）、付费回跳解锁（AC-P2/P4）。`isTrialHash` 实际未被下游使用（章节 "试读" 徽标用硬编码 `i<2`），是死代码但会崩溃。
- **建议**: 删除该行/该 useMemo，或改为正确构造 `Set<string>`（`order.filter(c=>c.content!==null).map(c=>c.slug)` 构造 set）。删除即可（未使用）。

### P1-1 · 自动保存 percent 恒为 100（进度分类错误）
- **文件**: `components/reader/reader.tsx` 行 150-152 `currentPercentThunk()`
- **问题**: `... / 0 = Infinity` → `Math.min(100, Infinity) = 100`。滚动触发的 `maybeSave` 用此 thunk 写库 → 任何一次滚动自动保存后 `reading_progress.percent=100`。
- **影响**: 书架/阅读中/已读分类错误（书一滚动就被标「已读完」）。位置恢复依赖 `chapter_slug+paragraph_id`（正确）故续读仍可用，但分类错乱。`goTo` 切章用的是正确 `computePercent`，但紧随其后的 onScroll 自动保存又会覆盖为 100。
- **建议**: `currentPercentThunk` 改为基于滚动位置/段落锚点的真实百分比；至少复用 `computePercent(currentIndex)` + 段内偏移，避免除 0。

### P1-2 · 解锁后当前锁定章节空白（AC-P2/P4 显示缺口）
- **文件**: `components/reader/reader.tsx`
- **问题**: 付费轮询成功 `purchased=true` + `router.refresh()` 后，`chapters` prop 更新为全文，但 `current` state 未随之重映射。若当前正展示的是锁定章节（`current.content===null`），则 `showPaidWall` 变 false（因已购）而正文仍空 → **无付费墙也无正文的空白**，直到用户上/下章导航。
- **影响**: 付费回跳时用户停在某个锁定章节会看到空白，正好落在 AC-P2/P4 的回跳解锁场景。
- **建议**: 当 `purchased` 由 false→true 时，用一个 effect 将 `current` 重新映射到 `order` 中同 slug 的章节（此时 content 已非空），并滚动到上次锚点。

### P1-3 · 断网进度不同步（AC-R8 缺口）
- **文件**: `components/reader/reader.tsx` `persist`
- **问题**: 离线时 `persist` 失败仅 `setSaveError`（本地缓冲保留），但**没有重连重试循环 / online 监听**（仅有 keyboard `keydown` 监听）。
- **影响**: 断网期间的进度不会在恢复网络后自动同步，与 AC-R8「网络恢复后暂存进度同步成功」不符。
- **建议**: 增加 `online` 事件监听或定时重试队列：`persist` 失败时入队，`window` `online` 时 flush 暂存进度。

### P2（建议，非阻断）
- 章节下拉「试读」徽标实际用硬编码 `i<2`，与 `trial_chapters`/`trial_percent` 配置解耦，若单书试读阈值非 2 章会显示不一致（建议改用 `isTrialHash` 正确构造后传入，或按 config 渲染）。
- `isTrialHash` 死代码（本应承担试读徽标/解锁判断，现废弃）。
- 若干性能微项（如每 render 重建 pendingSave 对象）不阻断。

---

## 四、需外部部署联调验证的项（无法静态判定，供运维/验收排期）

- **AC-P2/P3/P6/P7**: 真实 Stripe Checkout + webhook 签名校验 + 事件幂等 + 退款（需 sk/whsec 测试密钥）。
- **AC-A2/A4 / AC-E1~E3**: Resend 欢迎/重置邮件真实送达 + token 重置（需 RESEND_API_KEY + 已验证发信域名）。
- **AC-N1**: RLS 真实行为（books 公开读、chapters 正文按 purchase 私有）需在真实 Supabase 项目验证策略生效。
- **AC-M2/M4**: 后台 CRUD + Storage（covers bucket）上传联调（需 service-role + ADMIN_EMAILS）。
- **AC-N2**: 首屏 LCP 性能基线（Vercel 部署后实测）。
- 币种/汇率/税务合规（PRD Q1/Q3）：业务侧确认，运维配 env。

---

## 五、复核要求

P0-1（崩溃）与 P1-1~3 修复后，应重新静态复核：
1. Reader 组件不再含「把对象当函数调用」类表达式；`useMemo` 工厂内无死代码抛错。
2. `percent` 计算无除 0；书架分类正确。
3. 付费解锁后当前锁定章节能立即显示正文（current state 重映射）。
4. 断网进度有重连同步机制。

复核通过后，本审查结论可升级为「通过」，并连同修复说明一并回传产品域做最终验收。

---

## 六、修复记录

- **task_id**: `bookshop_fix`
- **修复方**: engineering / service（`ds-engineering-service`）
- **日期**: 2026-08-19
- **修复对象**: `components/reader/reader.tsx`（仅此一文件，其余 REVIEW 已确认文件保持不动）
- **自检结果**: 均通过（见各条）

### P0-1 · 阅读器崩溃（已修复）
- **改动点**: `reader.tsx` 行 70-71。
- **修复方式**: 删除存在缺陷的 `isTrialHash` useMemo（`new Set(...)(0)` 把 Set 当函数调用）。该变量确为死代码：试读徽标原本用硬编码 `i<2`，未引用它。
- **连带清理**: 删除 `<ChapterDropdown isTrialMap={isTrialHash} />` 传参与 ChapterDropdown 组件的 `isTrialMap: Set<string>` 参数声明（该参数非必须，已移除）。经确认 `new Set` 无残留、无任何「把对象当函数调用」表达式。
- **要求覆盖**: 消除运行时 TypeError，Reader 可正常渲染。

### P1-1 · 自动保存 percent 恒为 100（已修复）
- **改动点**: `reader.tsx` 的 `currentPercentThunk()`。
- **修复方式**: 删除原 `... / 0`（=Infinity→min(100,Inf)=100）占位实现，改为基于真实进度的计算：`base = (currentIndex / totalChapters) * 100`（章节维度进度）+ 当前激活段落 `activeParagraph` 在章内相对位置的偏移 `offset = (found/(paras.length-1)) * (100/totalChapters)`，最后 `Math.min(100, Math.round(base+offset))` clamp 到 0–100。**全程无除 0**（`totalCharts<=0` 早退返回 0；段内 `paras.length>1` 才计算 offset）。
- **自检**: `grep '/ 0'` 无除零表达式残留；滚动 maybeSave 写库为真实百分比，书架分类不再因单击滚动被误标「已读完」。

### P1-2 · 解锁后当前锁定章节空白（已修复）
- **改动点**: `reader.tsx` 新增解锁重映射 effect。
- **修复方式**: 新增 `prevPurchasedRef` 记录上一 purchased 值；新增 `useEffect`，当 `purchased` 由 false→true 且 `current.content===null` 时，将 `current` 重映射为 `order` 中同 slug 的章节（此时该章 content 已为全文），并在下一帧 `scrollIntoView` 滚回 `activeParagraph` 锚点。effect 依赖 `[purchased, order, current]`，即使 `router.refresh()` 后 chapters prop 异步更新，也会在 order 更新后再次触发补做重映射，覆盖两种时序。
- **验收对应**: 覆盖 AC-P2/P4 回跳解锁后停在锁定章节的空白显示缺口。

### P1-3 · 断网进度不同步（AC-R8）（已修复）
- **改动点**: `reader.tsx` 的 `persist` 与新增重连监听。
- **修复方式**: 新增 `offlinePendingSave` ref 作为离线暂存缓冲。`persist` 失败时不再仅 `setSaveError`，而是把待同步 payload 存入 `offlinePendingSave`；新增 `window.addEventListener('online', onOnline)` effect，网络恢复且 `isLoggedIn` 且存在离线缓冲时，自动调用 `void persist()` 把暂存进度 POST 同步，成功后清空缓冲。
- **验收对应**: 覆盖 AC-R8「断网期间进度在网络恢复后自动同步」。

### P2 · 试读徽标硬编码 i<2（已改进）
- **改动点**: `reader.tsx` `ChapterDropdown` 内试读徽标渲染条件。
- **修复方式**: 由于 P0-1 已删除 `isTrialHash`，将徽标条件由硬编码 `i < 2` 改为 `ch.content !== null`（该章正文对匿名/未购者可见即为试读章），与 `withContentAccess` / `isTrialChapter = current.content!==null` 的判定口径一致，与单书 trial_* 配置解耦问题消解。

### 复核要求对照（§五）
1. ✅ Reader 无「把对象当函数调用」表达式（`new Set` 无残留）。
2. ✅ percent 无除 0；书架分类正确。
3. ✅ 付费解锁后当前锁定章节能立即显示正文（current 重映射 effect 就位）。
4. ✅ 断网进度有重连同步机制（online 监听 + 离线缓冲 flush）。
