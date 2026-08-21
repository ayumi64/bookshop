'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Review, ReviewFormResult } from '@/lib/types';
import { RATING_LABELS } from '@/lib/types';
import { Stars } from './stars';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThumbsUp, Flag } from 'lucide-react';
import { toggleVoteAction, reportReviewAction } from '@/app/(marketing)/books/[slug]/reviews-actions';

/** Avatar initial from a display name (nickname), fallback to 「客」. */
function Avatar({ name }: { name: string | null }) {
  const initial = (name || '客').trim().charAt(0) || '客';
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground"
    >
      {initial}
    </span>
  );
}

/** A single review article (FR-RR-20/FR-RR-24/O-A-RR-05). */
function ReviewItem({
  review,
  bookSlug,
  isLoggedIn,
  isMine,
}: {
  review: Review & { display_name?: string | null; purchased?: boolean; voted?: boolean; votes?: number };
  bookSlug: string;
  isLoggedIn: boolean;
  isMine: boolean;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState(Boolean(review.voted));
  const [votes, setVotes] = useState(review.votes ?? 0);
  const [voteLoad, setVoteLoad] = useState(false);
  const [voteErr, setVoteErr] = useState<string | null>(null);
  const [reportState, setReportState] = useState<'idle' | 'confirm' | 'done' | 'error'>('idle');

  const date = new Date(review.created_at);
  const dateLabel = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

  function goLogin() {
    router.push(`/login?next=${encodeURIComponent(`/books/${bookSlug}`)}`);
  }

  async function handleVote() {
    if (!isLoggedIn) return goLogin();
    setVoteLoad(true);
    setVoteErr(null);
    const fd = new FormData();
    fd.set('reviewId', review.id);
    if (bookSlug) fd.set('bookSlug', bookSlug);
    try {
      const res = await toggleVoteAction(fd as unknown as FormData);
      if (!res.ok) {
        setVoteErr(res.error ?? '操作失败。');
        setVoteLoad(false);
        return;
      }
      setVoted((v) => !v);
      setVotes((c) => (voted ? c - 1 : c + 1));
      setVoteLoad(false);
      router.refresh();
    } catch (e) {
      setVoteErr(e instanceof Error ? e.message : '操作失败。');
      setVoteLoad(false);
    }
  }

  async function handleReport() {
    if (!isLoggedIn) return goLogin();
    if (reportState !== 'confirm') {
      setReportState('confirm');
      return;
    }
    setReportState('idle');
    const fd = new FormData();
    fd.set('reviewId', review.id);
    if (bookSlug) fd.set('bookSlug', bookSlug);
    try {
      const res = await reportReviewAction(fd as unknown as FormData);
      setReportState(res.ok ? 'done' : 'error');
    } catch {
      setReportState('error');
    }
  }

  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Avatar name={review.display_name ?? null} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{review.display_name || '读者'}</span>
            <Stars value={review.rating} filled={review.rating} label={`${review.rating} 星：${RATING_LABELS[review.rating]}`} size="text-sm" />
            <span className="text-xs text-muted-foreground">{RATING_LABELS[review.rating]}</span>
            {review.editor_pick && (
              <Badge variant="secondary" className="text-xs">编辑推荐</Badge>
            )}
          </div>

          {review.content && (
            <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{review.content}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{dateLabel}</span>
            {/* 已读/已购徽标：绿 #16A34A + 文字标签，双通道（A-RR-08 / FR-RR-30/31） */}
            {review.purchased && (
              <Badge variant="success" className="text-[11px]">已购</Badge>
            )}
            {review.declared_read && (
              <Badge variant="success" className="text-[11px]">已读</Badge>
            )}

            <button
              type="button"
              onClick={handleVote}
              disabled={voteLoad}
              aria-pressed={voted}
              className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                voted ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent text-muted-foreground'
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{votes >= 0 ? votes : 0} 有用</span>
              {voted && <span className="sr-only">（你已标记有用）</span>}
            </button>

            <button
              type="button"
              onClick={handleReport}
              className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              {reportState === 'confirm' ? '确认举报？' : reportState === 'done' ? '已举报' : reportState === 'error' ? '举报失败，请重试' : '举报'}
            </button>

            {isMine && <span className="text-muted-foreground">（我的评价）</span>}
          </div>

          {voteErr && <p role="alert" className="mt-1 text-xs text-destructive">{voteErr}</p>}
        </div>
      </div>
    </article>
  );
}

/** <ul> of review <article>s (FR-RR-20 / A-RR-05). */
export function ReviewList({
  reviews,
  bookSlug,
  isLoggedIn,
  isMine,
}: {
  reviews: Array<Review & { display_name?: string | null; purchased?: boolean; voted?: boolean; votes?: number }>;
  bookSlug: string;
  isLoggedIn: boolean;
  isMine: (r: Review) => boolean;
}) {
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id}>
          <ReviewItem review={r} bookSlug={bookSlug} isLoggedIn={isLoggedIn} isMine={isMine(r)} />
        </li>
      ))}
    </ul>
  );
}
