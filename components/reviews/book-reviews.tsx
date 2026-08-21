'use client';

/**
 * Phase 2 — Ratings & Reviews client block for the book detail page.
 * Server component (page.tsx) fetches the bundle via lib/reviews and passes
 * serializable props here. All interactivity (fold/sort/filter/vote/form)
 * lives client-side; every mutation goes through Server Actions + revalidate so
 * the aggregate/list stay consistent (就地刷新, N-RR-01).
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { BookReviewStats, Review, ReviewFormResult, ReviewItem } from '@/lib/types';
import { Stars } from './stars';
import { RATING_LABELS, formatCount } from '@/lib/reviews-format';
import { StarRatingInput } from './star-rating-input';
import { ReviewForm } from './review-form';
import { ReviewList } from './review-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PenLine } from 'lucide-react';

export interface BookReviewsProps {
  book: { id: string; slug: string; title: string };
  stats: BookReviewStats | null;
  reviews: ReviewItem[];
  total: number;
  mine: Review | null;
  isLoggedIn: boolean;
  viewerPurchased: boolean;
}

const STAR_LABELS: Record<number, string> = {
  5: '力荐', 4: '推荐', 3: '还行', 2: '较差', 1: '很差',
};

export function BookReviews({
  book,
  stats,
  reviews,
  total,
  mine,
  isLoggedIn,
  viewerPurchased,
}: BookReviewsProps) {
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [sort, setSort] = useState<'latest' | 'helpful'>('latest');
  const [folded, setFolded] = useState(reviews.length >= 5);
  const [showForm, setShowForm] = useState(false);

  const hasReviews = !!stats && stats.review_count > 0;
  const avg = stats?.avg_rating != null ? Number(stats.avg_rating) : null;

  const filtered = starFilter
    ? reviews.filter((r) => r.rating === starFilter)
    : reviews;
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === 'helpful') arr.sort((a, b) => b.votes - a.votes);
    else arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return arr;
  }, [filtered, sort]);

  const shown = folded ? sorted.slice(0, 5) : sorted;

  const histogram = stats
    ? ([5, 4, 3, 2, 1] as const).map((n) => ({
        stars: n,
        label: STAR_LABELS[n],
        count: stats[`r${n}` as 'r5'],
      }))
    : [];

  return (
    <section aria-labelledby="reviews-heading" className="mt-10">
      <h2 id="reviews-heading" className="mb-4 text-lg font-semibold">评分与评论</h2>

      {/* ---------------- 评分总览 ---------------- */}
      <Card className="mb-6">
        <CardContent className="p-6">
          {hasReviews && avg != null ? (
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              {/* 平均分 + 人数 + 已读/已购规模 */}
              <div className="md:w-44">
                <div className="flex items-end gap-2">
                  <Stars value={avg} label={`${avg} 星（满分 5 星）`} size="text-3xl" />
                  <span className="text-3xl font-semibold leading-none">{avg.toFixed(1)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatCount(stats.review_count)} 人评价
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  已读 {formatCount(stats.read_count)} · 已购 {formatCount(stats.bought_count)}
                </p>
              </div>

              {/* 五档分布直方图（dl + 百分比文本，可键盘聚焦过滤 A-RR-02/FR-RR-08） */}
              <div className="flex-1">
                <dl className="space-y-1.5">
                  {histogram.map((h) => {
                    const pct =
                      stats.review_count > 0
                        ? Math.round((h.count / stats.review_count) * 100)
                        : 0;
                    const active = starFilter === h.stars;
                    return (
                      <div key={h.stars} className="flex items-center gap-3">
                        <dt className="w-16 shrink-0 text-sm">
                          <button
                            type="button"
                            onClick={() => setStarFilter(active ? null : h.stars)}
                            aria-pressed={active}
                            className="flex items-center gap-1 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Stars value={h.stars} filled={1} label={`${h.stars} 星`} size="text-sm" />
                            <span className="text-xs">{h.stars}★ {h.label}</span>
                          </button>
                        </dt>
                        <dd className="min-w-0 flex-1">
                          <div
                            role="meter"
                            aria-label={`${h.stars} 星占 ${pct}%`}
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="h-2 w-full rounded-full bg-muted"
                          >
                            <div
                              className="h-2 rounded-full bg-amber-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </dd>
                        <dd className="w-12 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                          {pct}%
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  点击星级横条可过滤对应星级的短评
                  {starFilter && (
                    <button
                      type="button"
                      onClick={() => setStarFilter(null)}
                      className="ml-2 underline text-primary"
                    >
                      清除过滤
                    </button>
                  )}
                </p>
              </div>
            </div>
          ) : (
            /* 空态：不显示「0.0 分」 (FR-RR-07 / FR-RR-40) */
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-medium">暂无评分</p>
                <p className="text-sm text-muted-foreground">成为第一个评价《{book.title}》的人。</p>
              </div>
              {isLoggedIn ? (
                <Button onClick={() => setShowForm((v) => !v)} variant="outline">
                  <PenLine className="h-4 w-4" aria-hidden="true" /> 抢先评价
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href={`/login?next=${encodeURIComponent(`/books/${book.slug}`)}`}>抢先评价</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- 我的评价 / 写短评 ---------------- */}
      <div className="mb-6">
        {mine ? (
          <ReviewForm
            key={`mine-${mine.id}-${mine.updated_at}`}
            book={book}
            existing={mine}
            isLoggedIn={isLoggedIn}
            mode="edit"
            viewerPurchased={viewerPurchased}
            onCloseEdit={() => setShowForm(false)}
          />
        ) : (
          isLoggedIn && (
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowForm((v) => !v)}>
                <PenLine className="h-4 w-4" aria-hidden="true" /> 写短评 / 评分
              </Button>
            </div>
          )
        )}
        {showForm && !mine && isLoggedIn && (
          <div className="mt-3">
            <ReviewForm
              key={`new-${book.id}`}
              book={book}
              isLoggedIn={isLoggedIn}
              mode="create"
              viewerPurchased={viewerPurchased}
              onCloseEdit={() => setShowForm(false)}
            />
          </div>
        )}
      </div>

      {/* ---------------- 短评流 ---------------- */}
      <div
        id={`reviews-${book.slug}`}
        className={hasReviews ? '' : 'mt-2'}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-medium">短评</h3>
          {hasReviews && (
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setSort('latest')}
                aria-pressed={sort === 'latest'}
                className={`rounded-sm px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sort === 'latest' ? 'text-primary font-medium' : 'text-muted-foreground'}`}
              >
                最新
              </button>
              <button
                type="button"
                onClick={() => setSort('helpful')}
                aria-pressed={sort === 'helpful'}
                className={`rounded-sm px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${sort === 'helpful' ? 'text-primary font-medium' : 'text-muted-foreground'}`}
              >
                有用数
              </button>
            </div>
          )}
        </div>

        {hasReviews ? (
          <>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">该星级下暂无短评。</p>
            ) : (
              <ReviewList
                reviews={shown}
                bookSlug={book.slug}
                isLoggedIn={isLoggedIn}
                isMine={(r) => !!mine && mine.id === r.id}
              />
            )}
            {total > 5 && (
              <div className="mt-3 text-center">
                <Button variant="outline" onClick={() => setFolded((v) => !v)}>
                  {folded ? `查看全部 ${total} 条` : '收起'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">还没有短评，来写第一条吧。</p>
        )}
      </div>
    </section>
  );
}
