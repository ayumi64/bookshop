-- ============================================================================
-- RLS policies (PRD §6.2, §7.1; AC-N1)
-- Security boundary: 试读内容公开、正文私有按 purchase。RLS 是最终防线。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BOOKS: readonly to anon & authenticated, but ONLY published rows.
-- Draft / archived rows stay hidden from app clients (never served).
-- ---------------------------------------------------------------------------
create policy books_select_published on public.books
  for select to anon, authenticated
  using (status = 'published');

-- Admin writes (Server Action backed by a security-definer function / service
-- role) bypass RLS, or run as the authenticated admin; the admin SELECT is via
-- a security-definer view below. No general INSERT/UPDATE/DELETE to clients.

-- ---------------------------------------------------------------------------
-- CHAPTERS:
--  - anon / authenticated may SELECT trial chapters (public metadata + body).
--  - authenticated may SELECT the FULL content ONLY when they have a paid
--    purchase for the parent book (RLS subquery on purchases).
--  This is one coherent policy: a purchaser sees all chapters; a non-purchaser
--  sees only chapter rows with is_trial=true (or in the trial window).
-- ---------------------------------------------------------------------------

-- Trial access (public). A chapter is trial when it is explicitly flagged OR
-- when it falls inside the book's trial window, where the window is defined as
--   min( trialChapters, floor(trialPercent% × totalChapters) )
-- which is exactly what lib/trial.ts computes (PRD Q5 / FR-B-03). We reproduce
-- it here via a correlated subquery so RLS (the final defense) matches the app.
create policy chapters_select_trial on public.chapters
  for select to anon, authenticated
  using (
    is_trial = true
    OR
    -- inside the configured window (relative to row's own book)
    (
      exists (
        select 1 from public.books b
        where b.id = chapters.book_id
          and chapters.sort_order <= b.trial_chapters
          and chapters.sort_order <= (b.trial_percent * (
                select count(*) from public.chapters c
                where c.book_id = b.id
              ) * 1.0 / 100)::int
      )
    )
  );

-- Full content when purchased (RLS subquery on purchases.status='paid').
create policy chapters_select_purchased on public.chapters
  for select to authenticated
  using (
    exists (
      select 1 from public.purchases p
      where p.user_id = auth.uid()
        and p.book_id = chapters.book_id
        and p.status = 'paid'
    )
  );

-- ---------------------------------------------------------------------------
-- PURCHASES: user may read own rows; insert is allowed but the app/webhook only
-- uses service role for status mutations — client insert is explicitly limited
-- to status='pending' so users cannot self-grant 'paid'.
-- ---------------------------------------------------------------------------
create policy purchases_select_own on public.purchases
  for select to authenticated
  using (auth.uid() = user_id);

-- Users may insert only a *pending* purchase record (reserved seat). They can
-- NOT set status=paid or modify amount. Webhook writes via service role.
create policy purchases_insert_pending on public.purchases
  for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

-- No UPDATE/DELETE for authenticated users (webhook/service role writes).

-- ---------------------------------------------------------------------------
-- READING_PROGRESS: 仅本人 select/insert/update/delete
-- ---------------------------------------------------------------------------
create policy rp_select_own on public.reading_progress
  for select to authenticated using (auth.uid() = user_id);
create policy rp_insert_own on public.reading_progress
  for insert to authenticated with check (auth.uid() = user_id);
create policy rp_update_own on public.reading_progress
  for update to authenticated using (auth.uid() = user_id);
create policy rp_delete_own on public.reading_progress
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- PROFILES: 仅本人 (see 0001)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Trigger: bump updated_at on books / profiles / purchases
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
  before update on public.books for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists purchases_set_updated_at on public.purchases;
create trigger purchases_set_updated_at
  before update on public.purchases for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Security definer helpers for the admin area.
-- Admin route handlers use the service-role client (bypasses RLS). For extra
-- defense, expose an admin-only security-definer view that still filters on the
-- CURRENT_USER role to prevent accidental exposure from ordinary clients.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select coalesce(
    (select true from auth.users u
      where u.id = auth.uid()
        and u.email in (select trim(x::text) from unnest(string_to_array(current_setting('app.admin_emails', true), ',')) x
                        where trim(x::text) <> '')),
    false
  );
$$;
