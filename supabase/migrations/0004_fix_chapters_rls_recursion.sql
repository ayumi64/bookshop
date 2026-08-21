-- ============================================================================
-- FIX: chapters RLS infinite recursion (H1 blocker RLS-1)
-- ============================================================================
-- Root cause: policy `chapters_select_trial` (0002) had a correlated subquery
-- that SELECTed from `chapters` itself:
--
--     ... (b.trial_percent * (select count(*) from public.chapters c
--                              where c.book_id = b.id) * 1.0 / 100)::int ...
--
-- Because `chapters` has RLS enabled, Postgres re-enters the `chapters`
-- row-security checks while evaluating that count(*) subquery, which re-runs
-- the very same policy → infinite recursion:
--     "infinite recursion detected in policy for relation \"chapters\""
-- (observed live:       anon `select from chapters` -> 42P17 error, 0 rows)
--
-- Fix: move the per-book chapter count into a SECURITY DEFINER helper
-- `public.chapters_total(book_uuid)`. It runs with owner privileges (bypasses
-- RLS on `chapters`), so the policy no longer re-enters `chapters` RLS → the
-- cycle is broken. The trial-window semantics are byte-for-byte preserved
-- (matches lib/trial.ts: is_trial OR (sort<=trial_chapters AND
-- sort<=floor(trialPercent% × totalChapters))).
--
-- Migration ordering: apply AFTER 0001 (tables) and 0002 (policies).
-- Idempotent: drop policy before re-creating; function is CREATE OR REPLACE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Security-definer helper: total chapter count for a book (bypasses RLS).
--    security definer + search_path pinned to public to avoid the recursion.
-- ---------------------------------------------------------------------------
create or replace function public.chapters_total(book_uuid uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.chapters where book_id = book_uuid;
$$;

revoke all on function public.chapters_total(uuid) from public;
-- Grant execute to the roles the trial policy runs under (anon/authenticated).
grant execute on function public.chapters_total(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Replace the trial policy with the recursion-safe version.
-- ---------------------------------------------------------------------------
drop policy if exists chapters_select_trial on public.chapters;

create policy chapters_select_trial on public.chapters
  for select to anon, authenticated
  using (
    is_trial = true
    OR
    -- inside the configured window (relative to row's own book); total is
    -- computed via the security-definer helper to avoid re-entering chapters RLS
    (
      exists (
        select 1 from public.books b
        where b.id = chapters.book_id
          and chapters.sort_order <= b.trial_chapters
          and chapters.sort_order <= (b.trial_percent * public.chapters_total(b.id) * 1.0 / 100)::int
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) The purchased-policy is untouched (it already avoids self-reference and
--    has no cycle). Confirm it still exists:
-- ---------------------------------------------------------------------------
-- create policy chapters_select_purchased on public.chapters
--   for select to authenticated using (
--     exists (select 1 from public.purchases p
--             where p.user_id = auth.uid()
--               and p.book_id = chapters.book_id and p.status = 'paid')
--   );
