# Book Shop MVP — 工程审查修复摘要

- **task_id**: `bookshop_fix`
- **status**: PASS（修复完成 + 静态自检通过；未部署、未合并、未写真实密钥）
- **修复方**: engineering / service（`ds-engineering-service`）
- **日期**: 2026-08-19
- **审查依据**: `review.md`（`bookshop_review`）

## summary

修复 Book Shop + Reader MVP 工程审查发现的全部问题项，仅改动阅读器组件 `components/reader/reader.tsx`：

- **P0-1 阅读器崩溃**：删除把 Set 当函数调用的 `isTrialHash` useMemo（死代码），并连带清理 `<ChapterDropdown isTrialMap=…>` 传参与组件参数。`new Set` 无残留，Reader 正常渲染。
- **P1-1 自动保存 percent 恒为 100**：`currentPercentThunk()` 由 `/ 0 = Infinity → 100` 的占位实现，改为「章节维度 base + 激活段落段内偏移」真实百分比，clamp 0–100，无除 0。滚动 maybeSave 写入真实进度，书架分类恢复正确。
- **P1-2 解锁后当前锁定章节空白**：新增 `prevPurchasedRef` + useEffect，在 purchased 由 false→true 且 `current.content===null` 时，将 `current` 重映射到 `order` 同 slug 全文章并滚回锚点；依赖含 `order`，兼容 router.refresh 异步章节更新。
- **P1-3 断网进度不同步（AC-R8）**：新增 `offlinePendingSave` 离线缓冲 ref；persist 失败并入队，`window.addEventListener('online')` 监听网络恢复后自动 flush POST 同步，成功后清空缓冲。
- **P2 试读徽标硬编码 i<2**：改为 `ch.content !== null`（与 `isTrialChapter`/`withContentAccess` 口径一致），与单书 trial_* 配置解耦。

## self-check（自检结果）

- ✅ 无 `new Set` 残留调用对象写法（grep 验证）。
- ✅ 无 `/ 0` 除零表达式（grep 验证）。
- ✅ purchased 变化有 current 重映射 effect。
- ✅ 有 `window.addEventListener('online', …)` 重连监听 + 离线缓冲 flush。
- ✅ 未改动 RLS / webhook / checkout / data.ts / admin / 文档等已确认文件。

## artifact_paths

- `components/reader/reader.tsx`（唯一代码改动文件）
- `review.md`（新增「六、修复记录」节）
- `fix-summary.md`（本文件）
