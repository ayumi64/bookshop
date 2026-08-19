'use server';

/**
 * Admin Server Actions (PRD §5.7 / §8.7 AC-M1~M4; Server Actions 校验 §7.1).
 *
 * Every action re-verifies admin permission server-side (defense-in-depth;
 * the middleware UI redirect is not sufficient on its own). Admin identity is
 * derived from the email being in the ADMIN_EMAILS env list (see
 * lib/config.isAdminEmail / lib/auth.isCurrentUserAdmin).
 *
 * Writes go through the service-role client (createServiceClient) which
 * bypasses RLS. This is intentional and matches migration 0002: admin writes
 * "Server Action backed by a security-definer function / service role".
 * The service role key must therefore never be used on the browser.
 *
 * Storage:
 *  - covers bucket (public) : cover files
 *  - book-content bucket (private) : full chapter/body blobs (migration 0003)
 *  The admin uploads the cover and an optional body file here via storage URLs.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { isCurrentUserAdmin } from '@/lib/auth';
import { TRIAL } from '@/lib/config';
import { isTrialChapter } from '@/lib/trial';

// ---------- shared helpers ----------

/** Terse result used by client forms for inline display (AC-M2). */
export type AdminFormState = { ok?: boolean; error?: string };

interface AdminUserCheck {
  ok: boolean;
  error?: string;
}

/** Server-side admin gate — every action calls this first (AC-M1). */
async function requireAdmin(): Promise<AdminUserCheck> {
  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return { ok: false, error: '无管理员权限。' };
  }
  return { ok: true };
}

/** Truncate / validate a slug so it's a safe URL segment. */
function cleanSlug(raw: string): string {
  const s = raw.trim().toLowerCase();
  return s
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const STATUSES = ['published', 'draft', 'archived'] as const;
type BookStatus = (typeof STATUSES)[number];

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Build a chapter row from a body blob uploaded to Storage (book-content).
 *
 * Trial marking (AC-M2 / PRD §9.3 Q5): `is_trial` respects the book's
 * configured `trial_chapters` / `trial_percent`, taking the SMALLER boundary
 * (i.e. fewer free chapters wins). Delegated to `lib/trial.isTrialChapter` so
 * this always agrees with the runtime trial boundary; book-level fall back to
 * the global TRIAL constants.
 */
function buildChapters(
  bookId: string,
  bodyText: string,
  opts: { trialChapters?: number; trialPercent?: number } = {},
): { slug: string; title: string; sort_order: number; is_trial: boolean; content: string }[] {
  const parts = bodyText.split(/\n{2,}|\r?\n(?=#+\s)/).filter((s) => s.trim().length > 0);
  // Fall back to splitting by blank line if no markdown headings were found.
  const raw = parts.length > 1 ? parts : bodyText.split(/\r?\n{2,}/).filter((s) => s.trim().length > 0);
  const totalChapters = raw.length;
  const trialOpts = {
    trialChapters: opts.trialChapters ?? TRIAL.trialChapters,
    trialPercent: opts.trialPercent ?? TRIAL.trialPercent,
    totalChapters,
  };
  return raw
    .map((chunk, i) => {
      const heading = chunk.match(/^#+\s*(.+)$/m)?.[1]?.trim() || `第 ${i + 1} 章`;
      const sort_order = i + 1;
      return {
        slug: `chapter-${i + 1}`,
        title: heading,
        sort_order,
        is_trial: isTrialChapter({ sort_order, is_trial: false }, trialOpts),
        content: chunk.trim(),
      };
    })
    .filter(Boolean);
}

// ---------- CRUD ----------

/** Create a book (上架入口, AC-M2). */
export async function createBook(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const supabase = createServiceClient();

  const slug = cleanSlug(String(formData.get('slug') ?? ''));
  const title = String(formData.get('title') ?? '').trim();
  const author = String(formData.get('author') ?? '').trim() || null;
  const category = String(formData.get('category') ?? '').trim() || null;
  const blurb = String(formData.get('blurb') ?? '').trim() || null;
  const priceCents = Number(formData.get('price') ?? 0);
  const currency = String(formData.get('currency') ?? 'usd').toLowerCase();
  const coverUrl = String(formData.get('cover_url') ?? '').trim() || null;
  const bodyLocation = String(formData.get('body_location') ?? '').trim() || null;
  const trialChapters = clampInt(Number(formData.get('trial_chapters') ?? 2), 0, 99);
  const trialPercent = clampInt(Number(formData.get('trial_percent') ?? 10), 0, 100);
  const statusRaw = String(formData.get('status') ?? 'published');
  const status = (STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as BookStatus)
    : 'published';

  if (!slug) return { ok: false, error: 'slug 必填（用作 URL，仅限 a-z0-9-）。' };
  if (!title) return { ok: false, error: '标题必填。' };
  if (!Number.isFinite(priceCents) || priceCents < 0)
    return { ok: false, error: '价格无效。' };

  // 表单以「元」（小数）输入，存储单位为「分」。
  const priceCentsInt = Math.round(priceCents * 100);

  // Optionally accept a raw body pasted in the form and split it into chapters.
  const bodyText = String(formData.get('body_text') ?? '');
  if (!bodyLocation && !bodyText) {
    return { ok: false, error: '请至少提供正文（Storage location 或直接粘贴正文）。' };
  }

  const { data: book, error } = await supabase
    .from('books')
    .insert({
      slug,
      title,
      author,
      category,
      blurb,
      price_cents: priceCentsInt,
      currency,
      cover_url: coverUrl,
      body_location: bodyLocation || `book-content/${slug}`,
      trial_chapters: trialChapters,
      trial_percent: trialPercent,
      status,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: `创建失败：${error.message}` };

  // Seed chapters from the pasted body if none stored in Storage.
  if (bodyText) {
    // Mark trial chapters per the book's configured trial thresholds
    // (trial_chapters / trial_percent, smaller wins, AC-M2 / PRD §9.3 Q5).
    const chapters = buildChapters(book.id, bodyText, { trialChapters, trialPercent });
    const { error: chErr } = await supabase.from('chapters').insert(chapters);
    if (chErr) return { ok: false, error: `章节写入失败：${chErr.message}` };
  }

  revalidatePath('/admin/books');
  revalidatePath('/books');
  redirect('/admin/books');
}

/** Update an existing book (编辑, AC-M2). */
export async function updateBook(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const id = String(formData.get('id') ?? '').trim();
  if (!id) return { ok: false, error: '缺少书籍 id。' };

  const supabase = createServiceClient();
  const slug = cleanSlug(String(formData.get('slug') ?? ''));
  const title = String(formData.get('title') ?? '').trim();
  const author = String(formData.get('author') ?? '').trim() || null;
  const category = String(formData.get('category') ?? '').trim() || null;
  const blurb = String(formData.get('blurb') ?? '').trim() || null;
  const priceCents = Number(formData.get('price') ?? 0);
  const currency = String(formData.get('currency') ?? 'usd').toLowerCase();
  const coverUrl = String(formData.get('cover_url') ?? '').trim() || null;
  const bodyLocation = String(formData.get('body_location') ?? '').trim() || null;
  const trialChapters = clampInt(Number(formData.get('trial_chapters') ?? 2), 0, 99);
  const trialPercent = clampInt(Number(formData.get('trial_percent') ?? 10), 0, 100);
  const statusRaw = String(formData.get('status') ?? 'published');
  const status = (STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as BookStatus)
    : 'published';

  if (!slug) return { ok: false, error: 'slug 必填。' };
  if (!title) return { ok: false, error: '标题必填。' };
  if (!Number.isFinite(priceCents) || priceCents < 0)
    return { ok: false, error: '价格无效。' };

  // 表单以「元」（小数）输入，存储单位为「分」。
  const priceCentsInt = Math.round(priceCents * 100);

  const { error } = await supabase
    .from('books')
    .update({
      slug,
      title,
      author,
      category,
      blurb,
      price_cents: priceCentsInt,
      currency,
      cover_url: coverUrl,
      body_location: bodyLocation || `book-content/${slug}`,
      trial_chapters: trialChapters,
      trial_percent: trialPercent,
      status,
    })
    .eq('id', id);

  if (error) return { ok: false, error: `保存失败：${error.message}` };

  revalidatePath('/admin/books');
  revalidatePath(`/admin/books/${id}/edit`);
  revalidatePath('/books');
  redirect(`/admin/books/${id}/edit`);
}

/** Publish (上架) a book — becomes visible on the storefront (AC-M2/M3). */
export async function publishBook(formData: FormData): Promise<void> {
  const gate = await requireAdmin();
  if (!gate.ok) return;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const supabase = createServiceClient();
  await supabase.from('books').update({ status: 'published' }).eq('id', id);
  revalidatePath('/admin/books');
  revalidatePath('/books');
}

/** Unpublish (下架) a book — hidden from storefront; owners keep access (AC-M3). */
export async function unpublishBook(formData: FormData): Promise<void> {
  const gate = await requireAdmin();
  if (!gate.ok) return;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;
  const supabase = createServiceClient();
  await supabase.from('books').update({ status: 'draft' }).eq('id', id);
  revalidatePath('/admin/books');
  revalidatePath('/books');
}
