-- ============================================================================
-- BookShop · Phase 2 — Ratings & Reviews (PRD bookshop-reviews §5)
-- ============================================================================
-- 用途：书籍详情页「评分与评论」最小闭环。
--  - `reviews`          每用户每书一条：rating(1-5 必填) + content(≈200 选填) + declared_read
--  - `review_votes`     有用投票：UNIQUE(user_id, review_id) 幂等，单向（无点踩）
--  - `book_review_stats` 聚合表（平均分/人数/五档分布/已读/已购）：由触发器维护，
--                        详情页读聚合不实时全表 COUNT/AVG（D-RR-07 降读放大）。
--  - `review_reports`   举报入口（二期弱后台：只落表/记日志，供运营后续处理）。
--  - `reviews_events`   聚合事件埋点轻量表（FR-RR-43；无现成 analytics 基建的取舍）。
--
-- 依赖：0001(profiles/books/purchases) 0002(RLS/trigger helpers) 0004(chapters 修复)。
-- reviews/RLS 独立于 0004；但 0004 是线上详情页 SSR 的既有阻塞（非本功能引入）。
-- 本 migration 不含对 0004 的依赖行为，可独立应用（上线前置仍须先应用 0004，见 impl.md）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- REVIEWS
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  rating        integer not null check (rating between 1 and 5), -- 1–5 星必填 (FR-RR-10/D-RR-02)
  content       text check (char_length(content) between 1 and 200), -- 选填 ≤200 字 (FR-RR-10/D-RR-02)
  declared_read boolean not null default false,                 -- 手动「已读」 (FR-RR-15/D-RR-06)
  editor_pick   boolean not null default false,                 -- 运营种子评分须标注「编辑推荐」 (FR-RR-41)
  report_count  integer not null default 0,                     -- 举报数（运营观察用）
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 每用户每书仅一条（防刷第一道闸 D-RR-02 / FR-RR-13）；编辑/删除走同一条 → OK
  unique (book_id, user_id)
);
create index if not exists reviews_book_idx on public.reviews (book_id);
create index if not exists reviews_user_idx on public.reviews (user_id);
alter table public.reviews enable row level security;

-- 已购规模统计依赖 purchases? no —— 已购标识由服务端依 purchase(status=paid) 计算（D-RR-05）。
-- 聚合表同时维护「已读人数」、「已购人数」（已购=该 book 有 paid 购买的 distinct user，服务端判定）。

-- ---------------------------------------------------------------------------
-- REVIEW_VOTES 有用投票
-- ---------------------------------------------------------------------------
create table if not exists public.review_votes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  review_id  uuid not null references public.reviews(id) on delete cascade,
  value      integer not null default 1 check (value = 1), -- 单向：仅「有用」(D-RR-03)
  created_at timestamptz not null default now(),
  -- 同用户同评论一次 + toggle（重复点击=取消，见 FR-RR-22 toggle 语义；工程取 toggle）
  unique (user_id, review_id)
);
create index if not exists review_votes_review_idx on public.review_votes (review_id);
alter table public.review_votes enable row level security;

-- ---------------------------------------------------------------------------
-- AGGREGATION: book_review_stats 聚合表（D-RR-07 / N-RR-02 降读放大）
-- ---------------------------------------------------------------------------
-- 替代物化视图：触发器维护，读端零实时 COUNT/AVG。结构为单行 per book：
--   avg_rating  numeric(3,1)  一位小数平均分
--   review_count int           评分人数
--   r5..r1       int[]         5★→1★ 分布（顺序 r5=5★)
--   read_count   int           声明已读人数
--   bought_count int           依 purchase(status=paid) 计算的已购人数（含未评分已购者）
-- 触发器在 reviews INSERT/UPDATE/DELETE 后重算该 book 的统计。
-- 已购人数单独在买购状态变化时维护（见下方 purchases 触发器），避免每次订阅 purchase。
create table if not exists public.book_review_stats (
  book_id      uuid primary key references public.books(id) on delete cascade,
  avg_rating   numeric(3,1),
  review_count integer not null default 0,
  r5 integer not null default 0,
  r4 integer not null default 0,
  r3 integer not null default 0,
  r2 integer not null default 0,
  r1 integer not null default 0,
  read_count   integer not null default 0,
  bought_count integer not null default 0,
  updated_at   timestamptz not null default now()
);
alter table public.book_review_stats enable row level security;
-- 公开读物化聚合（匿名 + 登录）。不含正文，无敏感。
create policy stats_select_public on public.book_review_stats
  for select to anon, authenticated using (true);

-- 计算函数：给定 book_id 重算 reviews 聚合（security definer 以绕过 reviews RLS，
-- 触发上下文运行；不暴露给客户端直连）。
create or replace function public.compute_book_review_stats(book_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.book_review_stats (book_id, avg_rating, review_count, r5, r4, r3, r2, r1, read_count, bought_count)
  select
    b.id,
    round(avg(r.rating)::numeric, 1),
    count(r.id),
    count(*) filter (where r.rating = 5),
    count(*) filter (where r.rating = 4),
    count(*) filter (where r.rating = 3),
    count(*) filter (where r.rating = 2),
    count(*) filter (where r.rating = 1),
    count(*) filter (where r.declared_read),
    -- 已购人数：本 book 有 paid purchase 的 distinct user（含未评分者）
    (select count(distinct p.user_id) from public.purchases p
      where p.book_id = b.id and p.status = 'paid')
  from public.books b
  left join public.reviews r on r.book_id = b.id
  where b.id = book_uuid
  group by b.id
  on conflict (book_id) do update set
    avg_rating   = excluded.avg_rating,
    review_count = excluded.review_count,
    r5 = excluded.r5, r4 = excluded.r4, r3 = excluded.r3, r2 = excluded.r2, r1 = excluded.r1,
    read_count   = excluded.read_count,
    bought_count = excluded.bought_count,
    updated_at   = now();
end;
$$;

-- reviews 变更 → 重算该 book 聚合
create or replace function public.reviews_touch_stats()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.compute_book_review_stats(
    case when tg_op = 'DELETE' then old.book_id else new.book_id end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_touch_stats on public.reviews;
create trigger reviews_touch_stats
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_touch_stats();

-- purchases 状态变更（paid 授予）→ 刷新该 book 已购人数（不重算评分）
create or replace function public.purchases_touch_stats()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.compute_book_review_stats(
    case when tg_op = 'DELETE' then old.book_id else new.book_id end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists purchases_touch_stats on public.purchases;
create trigger purchases_touch_stats
  after insert or update or delete on public.purchases
  for each row execute function public.purchases_touch_stats();

-- ---------------------------------------------------------------------------
-- RLS — REVIEWS (DR-RR-04)
--  读公开（含未登录，无付费墙）；写仅登录本人(auth.uid=user_id)；改/删仅本人。
-- ---------------------------------------------------------------------------
create policy reviews_select_public on public.reviews
  for select to anon, authenticated using (true);

create policy reviews_insert_own on public.reviews
  for insert to authenticated with check (auth.uid() = user_id);

create policy reviews_update_own on public.reviews
  for update to authenticated using (auth.uid() = user_id);

create policy reviews_delete_own on public.reviews
  for delete to authenticated using (auth.uid() = user_id);

-- 已购标识不可由客户端伪造（D-RR-05）：客户端只能写 declared_read；已购徽标由服务端依
-- purchases(status=paid) 计算（见 lib/reviews.ts）。RLS 不允许客户端改
-- user_id（insert/update 均 with check/using auth.uid()=user_id 兜底）。

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER 投影助手（P1-3 D-RR-05 已购作者 / P1-4 FR-RR-20 公开昵称）
-- ---------------------------------------------------------------------------
-- 二者以 security definer + 显式 search_path 运行（同 0004 chapters_total() 模式），
-- 以函数属主权限绕过 `purchases_select_own`(0002) / `profiles_select_own`(0001)
-- 对“他人行”的 RLS 过滤，但只暴露功能所需字段：
--   - reviews_paid_authors    ：返回 author user_id（其对该书有 paid 购买）。
--   - reviews_public_profiles ：仅投影昵称 display_name（不开放完整 profile 读，
--                                保持一期隐私边界）。
-- 客户端/服务端经 `.rpc()` 调用；函数本身不泄露其它用户购买明细或敏感 profile。
-- 产出仅限授予 anon/authenticated execute（调用本身无需任何角色即可安全执行，
-- 因为 security definer 属主权限在服务端完成判定，客户端无法伪造结果）。
create or replace function public.reviews_paid_authors(book_uuid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct r.user_id
  from public.reviews r
  where r.book_id = book_uuid
    and exists (
      select 1 from public.purchases p
      where p.book_id = book_uuid
        and p.user_id = r.user_id
        and p.status = 'paid'
    );
$$;
revoke all on function public.reviews_paid_authors(uuid) from public;
grant execute on function public.reviews_paid_authors(uuid) to anon, authenticated;

create or replace function public.reviews_public_profiles(book_uuid uuid)
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id as user_id, p.display_name
  from public.reviews r
  join public.profiles p on p.id = r.user_id
  where r.book_id = book_uuid;
$$;
revoke all on function public.reviews_public_profiles(uuid) from public;
grant execute on function public.reviews_public_profiles(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS — REVIEW_VOTES (D-RR-03 / FR-RR-22)
--  读公开（计数展示）；写仅登录本人；改/删本人（幂等 toggle = 删除本人投票）。
-- ---------------------------------------------------------------------------
create policy votes_select_public on public.review_votes
  for select to anon, authenticated using (true);

create policy votes_insert_own on public.review_votes
  for insert to authenticated with check (auth.uid() = user_id);

create policy votes_update_own on public.review_votes
  for update to authenticated using (auth.uid() = user_id);

create policy votes_delete_own on public.review_votes
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- REVIEW_REPORTS 举报（FR-RR-25 / FR-RR-43；二期弱后台：落表供运营观察）
-- ---------------------------------------------------------------------------
create table if not exists public.review_reports (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null, -- 可匿名举报
  reason     text,
  status     text not null default 'open',  -- open | resolved | dismissed
  created_at timestamptz not null default now(),
  unique (review_id, reporter_id)  -- 同人同评一次防刷
);
alter table public.review_reports enable row level security;
-- 读仅本人（或不公开）；写仅登录本人
create policy reports_select_own on public.review_reports
  for select to authenticated using (auth.uid() = reporter_id or public.is_admin());
create policy reports_insert_own on public.review_reports
  for insert to authenticated with check (auth.uid() = reporter_id);
-- 举报不删除（运营后续处理）；admin 可读全部（is_admin 由 0002 定义）。

-- ---------------------------------------------------------------------------
-- REVIEWS_EVENTS 轻量聚合事件埋点（FR-RR-43）
--  一期无现成 analytics 基建，落表 + README 标注接 ops 分析（取舍如实说明）。
-- ---------------------------------------------------------------------------
create table if not exists public.reviews_events (
  id         uuid primary key default gen_random_uuid(),
  event      text not null,           -- rating_summary_view | review_submit | review_vote | review_report
  book_id    uuid,
  review_id  uuid,
  user_id    uuid,                    -- 执行者（匿名曝光可为 null）
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists reviews_events_book_idx on public.reviews_events (book_id);
create index if not exists reviews_events_event_idx on public.reviews_events (event);
alter table public.reviews_events enable row level security;
-- 读取仅运营/admin（service-role 或 is_admin）；写入仅 service-role 由服务端记录，
-- 不强开放给 anon（避免刷埋点）。客户端不直接写本表。
create policy events_select_admin on public.reviews_events
  for select to authenticated using (public.is_admin());

-- updated_at 触发器（复用 0002 的 set_updated_at）用于 reviews
drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews for each row execute function public.set_updated_at();
