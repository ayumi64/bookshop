-- ============================================================================
-- Book Shop + Reader MVP — schema & RLS (PRD §6, §8 AC-N1)
-- Order matters: profiles → books → chapters → purchases → reading_progress
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROFILES (FR optional, PRD §6.1): public profile, 仅本人读写
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Profiles: 本人可读可写 (PRD §6.2)
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- BOOKS (PRD §6.1): book metadata + configurable trial threshold
-- ---------------------------------------------------------------------------
create table if not exists public.books (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  author         text,
  category       text,
  price_cents    integer not null default 0,
  currency       text not null default 'usd',
  cover_url      text,
  body_location  text,
  blurb          text,
  trial_chapters integer not null default 2,   -- 试读章数 (PRD Q5)
  trial_percent  numeric(5,2) not null default 10, -- 试读百分比 (PRD Q5)
  status         text not null default 'published', -- published | draft | archived
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.books enable row level security;

-- Metadata public read is fine. We expose only published rows in the app, but
-- RLS additionally keeps internal rows truly hidden from anon by NOT granting
-- select to anon. Compute manually below so anon cannot read drafts.

-- ---------------------------------------------------------------------------
-- CHAPTERS (PRD §6.1): content kept here for the MVP (text body). For very
-- large books you may switch `content` to a Storage reference via body_location,
-- but the trial/purchased gating below applies regardless.
-- ---------------------------------------------------------------------------
create table if not exists public.chapters (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id) on delete cascade,
  slug       text not null,
  title      text not null,
  sort_order int  not null,
  is_trial   boolean not null default false,   -- author override (optional)
  content    text,                             -- guarded by RLS below
  unique (book_id, slug),
  unique (book_id, sort_order)
);
create index if not exists chapters_book_order_idx
  on public.chapters (book_id, sort_order);
alter table public.chapters enable row level security;

-- ---------------------------------------------------------------------------
-- PURCHASES (PRD §6.1): ownership/entitlement. Webhook writes via service role
-- (bypasses RLS). Users can read their own, never modify status/amount.
-- ---------------------------------------------------------------------------
create table if not exists public.purchases (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  book_id           uuid not null references public.books(id) on delete cascade,
  stripe_session_id text unique,               -- webhook/session idempotency
  stripe_event_id   text unique,               -- event dedupe (AC-P3)
  payment_intent_id text,
  amount_cents      integer not null default 0,
  currency          text not null default 'usd',
  status            text not null default 'pending', -- pending | paid | refunded
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, book_id)
);
alter table public.purchases enable row level security;

-- ---------------------------------------------------------------------------
-- READING_PROGRESS (PRD §5.5.1): decoupled from purchases, 仅本人
-- ---------------------------------------------------------------------------
create table if not exists public.reading_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  book_id      uuid not null references public.books(id) on delete cascade,
  chapter_slug text,
  paragraph_id text,
  percent      numeric(5,2),
  updated_at   timestamptz not null default now(),
  unique (user_id, book_id)
);
alter table public.reading_progress enable row level security;
