'use server';

/**
 * Phase 2 — Ratings & Reviews server actions (PRD bookshop-reviews §5.2/5.3/5.4).
 * Verify auth + ownership server-side (RLS is the final defense in 0005).
 * Content compliance filter runs here before persisting (FR-RR-32).
 * Aggregation is refreshed by DB triggers; actions just revalidate the page so
 * the aggregate + list are re-fetched server-side (就地刷新, no client fake).
 */

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import type { ReviewFormResult } from '@/lib/types';
import { complianceViolation, normalizeContent } from '@/lib/reviews-compat';

const MAX_CONTENT = 200;

/** Clamp/validate a rating integer in 1..5. */
function validRating(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

/** Server-side event log (FR-RR-43).
 * `reviews_events` RLS (0005) intentionally exposes NO client insert policy so
 * guests/anon can't spam the analytics table (「客户端不直接写本表」). Writing
 * via the service-role client here keeps that boundary — events are recorded
 * only by server actions, never from the browser. best-effort; never blocks UI. */
async function logEvent(event: string, bookId?: string, reviewId?: string, meta?: object) {
  try {
    const service = createServiceClient();
    const { user } = await getCurrentUser();
    await service.from('reviews_events').insert({
      event,
      book_id: bookId ?? null,
      review_id: reviewId ?? null,
      user_id: user?.id ?? null,
      meta: meta ?? null,
    });
  } catch {
    // Analytics is best-effort; never block the user flow.
  }
}

/** Submit a ratings review (insert). One per (book, user) enforced by UNIQUE + RLS. */
export async function submitReviewAction(
  prev: ReviewFormResult,
  formData: FormData,
): Promise<ReviewFormResult> {
  const { user } = await getCurrentUser();
  if (!user) return { ok: false, error: '请先登录后再评价。' };

  const bookId = String(formData.get('bookId') ?? '');
  const rating = validRating(formData.get('rating'));
  if (!bookId) return { ok: false, error: '缺少书目信息。' };
  if (!rating) return { ok: false, error: '请先选择星级（必填）。' };

  const rawContent = String(formData.get('content') ?? '');
  const content = rawContent.trim() ? normalizeContent(rawContent) : null;
  if (content && content.length > MAX_CONTENT) {
    return { ok: false, error: `短评最多 ${MAX_CONTENT} 字。` };
  }
  if (content) {
    const violation = complianceViolation(content);
    if (violation) return { ok: false, error: violation };
  }

  const declaredRead = formData.get('declared_read') === 'on';

  const supabase = createClient();
  const { error } = await supabase.from('reviews').insert({
    book_id: bookId,
    user_id: user.id,
    rating,
    content,
    declared_read: declaredRead,
  });

  if (error) {
    // Duplicate → user already has a review for this book (FR-RR-13): guide to edit.
    if (error.message?.toLowerCase().includes('duplicate')) {
      return { ok: false, error: '你已评价过这本书，可在下方「我的评价」中编辑或删除。' };
    }
    return { ok: false, error: '提交失败，请稍后重试。' };
  }

  revalidatePath(`/books/${String(formData.get('bookSlug') ?? '')}`);
  revalidatePath('/books');
  await logEvent('review_submit', bookId, undefined, { rating, has_content: !!content });
  return { ok: true, submitted: true };
}

/** Update an existing review (owner only). */
export async function updateReviewAction(
  prev: ReviewFormResult,
  formData: FormData,
): Promise<ReviewFormResult> {
  const { user } = await getCurrentUser();
  if (!user) return { ok: false, error: '请先登录。' };

  const reviewId = String(formData.get('reviewId') ?? '');
  const bookSlug = String(formData.get('bookSlug') ?? '');
  const rating = validRating(formData.get('rating'));
  if (!reviewId) return { ok: false, error: '缺少评价信息。' };
  if (!rating) return { ok: false, error: '请先选择星级（必填）。' };

  const rawContent = String(formData.get('content') ?? '');
  const content = rawContent.trim() ? normalizeContent(rawContent) : null;
  if (content && content.length > MAX_CONTENT) {
    return { ok: false, error: `短评最多 ${MAX_CONTENT} 字。` };
  }
  if (content) {
    const violation = complianceViolation(content);
    if (violation) return { ok: false, error: violation };
  }

  const declaredRead = formData.get('declared_read') === 'on';

  const supabase = createClient();
  // RLS ensures only owner can update (D-RR-04).
  const { error } = await supabase
    .from('reviews')
    .update({ rating, content, declared_read: declaredRead })
    .eq('id', reviewId)
    .eq('user_id', user.id);

  if (error) {
    if (error.code === 'PGRST116') return { ok: false, error: '未找到该评价或无权限修改。' };
    return { ok: false, error: '更新失败，请稍后重试。' };
  }

  if (bookSlug) {
    revalidatePath(`/books/${bookSlug}`);
    revalidatePath('/books');
  }
  await logEvent('review_update', undefined, reviewId, { rating });
  return { ok: true, submitted: true };
}

/** Delete a review (owner only). */
export async function deleteReviewAction(
  prev: ReviewFormResult,
  formData: FormData,
): Promise<ReviewFormResult> {
  const { user } = await getCurrentUser();
  if (!user) return { ok: false, error: '请先登录。' };

  const reviewId = String(formData.get('reviewId') ?? '');
  const bookSlug = String(formData.get('bookSlug') ?? '');
  if (!reviewId) return { ok: false, error: '缺少评价信息。' };

  const supabase = createClient();
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', user.id);

  if (error) return { ok: false, error: '删除失败，请稍后重试。' };

  if (bookSlug) {
    revalidatePath(`/books/${bookSlug}`);
    revalidatePath('/books');
  }
  return { ok: true };
}

/**
 * Toggle a "helpful" vote (FR-RR-22). Idempotent toggle: if the current user
 * already voted, delete (cancel); otherwise insert. UNIQUE(user_id, review_id)
 * is the hard guard. Unauthenticated → error (client redirects to login).
 */
export async function toggleVoteAction(formData: FormData): Promise<ReviewFormResult> {
  const { user } = await getCurrentUser();
  if (!user) return { ok: false, error: '请先登录后再投票。' };

  const reviewId = String(formData.get('reviewId') ?? '');
  const bookSlug = String(formData.get('bookSlug') ?? '');
  if (!reviewId) return { ok: false, error: '缺少评论信息。' };

  const supabase = createClient();
  // Check existing vote.
  const { data: existing } = await supabase
    .from('review_votes')
    .select('id')
    .eq('user_id', user.id)
    .eq('review_id', reviewId)
    .maybeSingle();

  let error: { message?: string } | null = null;
  if (existing) {
    const res = await supabase.from('review_votes').delete().eq('id', existing.id);
    error = res.error;
  } else {
    const res = await supabase.from('review_votes').insert({ user_id: user.id, review_id: reviewId, value: 1 });
    error = res.error;
  }

  if (error) return { ok: false, error: '操作失败，请稍后重试。' };

  if (bookSlug) {
    revalidatePath(`/books/${bookSlug}`);
    revalidatePath('/books');
  }
  await logEvent('review_vote', undefined, reviewId, { on: !existing });
  return { ok: true };
}

/** Report a review (FR-RR-25/FR-RR-43). Owner-blind; dedupe per (review,reporter). */
export async function reportReviewAction(formData: FormData): Promise<ReviewFormResult> {
  const { user } = await getCurrentUser();
  if (!user) return { ok: false, error: '请先登录后再举报。' };

  const reviewId = String(formData.get('reviewId') ?? '');
  const bookSlug = String(formData.get('bookSlug') ?? '');
  const reason = String(formData.get('reason') ?? '').slice(0, 200);
  if (!reviewId) return { ok: false, error: '缺少评论信息。' };

  const supabase = createClient();
  const { error } = await supabase.from('review_reports').insert({
    review_id: reviewId,
    reporter_id: user.id,
    reason: reason || '用户举报（无原因）',
  });

  if (error) {
    if (error.message?.toLowerCase().includes('duplicate') || error.code === '23505') {
      return { ok: false, error: '你已举报过这条短评。' };
    }
    return { ok: false, error: '举报失败，请稍后重试。' };
  }

  if (bookSlug) revalidatePath(`/books/${bookSlug}`);
  await logEvent('review_report', undefined, reviewId, { reason });
  return { ok: true };
}
