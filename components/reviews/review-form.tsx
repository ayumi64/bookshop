'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Review, ReviewFormResult } from '@/lib/types';
import {
  submitReviewAction,
  updateReviewAction,
  deleteReviewAction,
} from '@/app/(marketing)/books/[slug]/reviews-actions';
import { StarRatingInput } from './star-rating-input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Pencil } from 'lucide-react';

const MAX_CONTENT = 200;

/** Create / edit / delete a review (client). Submits via server action + revalidate. */
export function ReviewForm({
  book,
  existing,
  isLoggedIn,
  mode,
  viewerPurchased,
  onCloseEdit,
}: {
  book: { id: string; slug: string; title: string };
  existing?: Review | null;
  isLoggedIn: boolean;
  mode: 'create' | 'edit';
  viewerPurchased: boolean;
  onCloseEdit?: () => void;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [content, setContent] = useState(existing?.content ?? '');
  const [declaredRead, setDeclaredRead] = useState(existing?.declared_read ?? false);
  const [error, setError] = useState<string | null>(null);
  const [starError, setStarError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const editing = mode === 'edit';
  const reviewId = existing?.id ?? '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/books/${book.slug}`)}`);
      return;
    }
    if (!rating) {
      setStarError('请先选择星级（必填）。');
      setError('请先选择星级。');
      return;
    }
    setStarError(null);
    setError(null);
    setLoading(true);

    const fd = new FormData();
    fd.set('bookId', book.id);
    if (book.slug) fd.set('bookSlug', book.slug);
    fd.set('rating', String(rating));
    fd.set('content', content);
    if (declaredRead) fd.set('declared_read', 'on');

    try {
      const res: ReviewFormResult = editing
        ? await updateReviewAction({}, fd as unknown as FormData)
        : await submitReviewAction({}, fd as unknown as FormData);
      if (!res.ok) {
        setError(res.error ?? '提交失败。');
        setLoading(false);
        return;
      }
      setSuccess(editing ? '评价已更新。' : '评价已提交。');
      setLoading(false);
      onCloseEdit?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败，请稍后重试。');
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('reviewId', reviewId);
      if (book.slug) fd.set('bookSlug', book.slug);
      const res = await deleteReviewAction({}, fd as unknown as FormData);
      if (!res.ok) {
        setError(res.error ?? '删除失败。');
        setLoading(false);
        return;
      }
      onCloseEdit?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败，请稍后重试。');
      setLoading(false);
    }
  }

  function goLogin() {
    router.push(`/login?next=${encodeURIComponent(`/books/${book.slug}`)}`);
  }

  const describedById = 'review-star-desc';

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium">{editing ? '我的评价' : `评价《${book.title}》`}</h4>
        {editing && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Pencil className="h-3 w-3" aria-hidden="true" /> 编辑
          </span>
        )}
      </div>

      {!isLoggedIn ? (
        <p className="mb-3 text-sm text-muted-foreground">
          请<button type="button" onClick={goLogin} className="text-primary underline">登录</button>后评价。
        </p>
      ) : (
        <>
          <div className="mb-4">
            <Label htmlFor="review-rating">你的评分</Label>
            <div id="review-rating" className="mt-1">
              <StarRatingInput
                name="rating"
                value={rating}
                onChange={(v) => {
                  setRating(v);
                  if (v) setStarError(null);
                }}
                errorId="review-rating-error"
                describedBy={starError ? undefined : describedById}
              />
            </div>
            {starError && (
              <p id="review-rating-error" role="alert" className="mt-1 text-sm text-destructive">
                {starError}
              </p>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="review-content">我的短评（选填）</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {content.length}/{MAX_CONTENT}
              </span>
            </div>
            <Textarea
              id="review-content"
              name="content"
              value={content}
              maxLength={MAX_CONTENT}
              onChange={(e) => setContent(e.target.value)}
              placeholder="一句话说说这本书（不超过 200 字）…"
              className="mt-1"
            />
          </div>

          <label className="mb-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={declaredRead}
              onChange={(e) => setDeclaredRead(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              我已读过这本书
              {viewerPurchased && <span className="ml-1 text-xs text-muted-foreground">（你已购，自动带「已购」标识）</span>}
            </span>
          </label>

          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>
          )}
          {success && !error && (
            <p role="status" className="mb-3 text-sm text-success">{success}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={loading || pending} size="sm">
              {(loading || pending) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {editing ? '保存修改' : '提交评价'}
            </Button>
            {editing && (
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {confirmingDelete ? '确认删除？' : '删除'}
              </Button>
            )}
            {mode === 'create' && onCloseEdit && (
              <Button type="button" variant="ghost" size="sm" onClick={onCloseEdit}>取消</Button>
            )}
          </div>
        </>
      )}
    </form>
  );
}
