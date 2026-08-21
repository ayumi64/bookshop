import { createClient } from '@/lib/supabase/server';
import type { BookReviewStats, Review, ReviewItem } from '@/lib/types';
import { RATING_LABELS, formatAvg, formatCount, starsFor } from '@/lib/reviews-format';

// Re-export pure display helpers so existing server-side importers keep working.
export { RATING_LABELS, formatAvg, formatCount, starsFor };

/**
 * Phase 2 — Ratings & Reviews server-side data access (bookshop-reviews).
 * RLS is the final defense (0005): read public (anon+authenticated), write only
 * owner. Name/badge resolution and vote status are applied here on the server
 * so the client can never forge `已购` / nicknames (D-RR-05 / FR-RR-20).
 *
 * 已购 badge (D-RR-05) is computed PER REVIEW AUTHOR via a SECURITY DEFINER
 * helper (`reviews_paid_authors`), because `purchases_select_own` (0002) only
 * lets a client read its own purchases — the server must project the author's
 * paid state without exposing other users' purchase rows to the client.
 * Nicknames (FR-RR-20) are projected via `reviews_public_profiles`, a SECURITY
 * DEFINER view over just `profiles.display_name`, so we do NOT open full profile
 * reads (privacy boundary of `profiles_select_own` stays intact).
 */

export interface ReviewsBundle {
  /** Aggregated stats (from book_review_stats; one row per book). */
  stats: BookReviewStats | null;
  /** Collapsed list of the front N reviews (folded on the page). */
  reviews: ReviewItem[];
  /** Count of all reviews for «查看全部 N 条». */
  total: number;
  /** The requesting user's own review of this book, if any. */
  mine: Review | null;
  /** Server-computed: has the requesting user bought this book (paid). */
  viewerPurchased: boolean;
}

/** Minimal shape of a `book_review_stats` aggregate row (no `id`). */
type StatsRow = BookReviewStats;

/** Minimal shape of a purchase row used to key the viewer's own paid set. */
interface PurchaseBookRow {
  book_id: string;
}

/** Minimal shape of a review_votes row used to key voted set. */
interface VoteReviewRow {
  review_id: string;
}

/** Shape of `reviews_public_profiles` SECURITY DEFINER output. */
interface PublicProfileRow {
  user_id: string;
  display_name: string | null;
}

/**
 * Load the review bundle for a book detail page.
 * `viewerId` may be absent (anonymous) — badges & vote status are computed for
 * that viewer server-side. Read is public (RLS).
 */
export async function getReviewsBundle(
  bookId: string,
  viewerId?: string | null,
  limit = 5,
): Promise<ReviewsBundle> {
  const supabase = createClient();

  const [statsRes, reviewsRes, mineRes] = await Promise.all([
    supabase.from('book_review_stats').select('*').eq('book_id', bookId).maybeSingle(),
    supabase
      .from('reviews')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false })
      .limit(limit),
    viewerId
      ? supabase.from('reviews').select('*').eq('book_id', bookId).eq('user_id', viewerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const stats: BookReviewStats | null = (statsRes.data as StatsRow | null) ?? null;
  const rawReviews = (reviewsRes.data ?? []) as Review[];
  const mine = (mineRes.data as Review | null) ?? null;

  // Secure projections (SECURITY DEFINER, run as function owner → bypass RLS on
  // purchases/profiles but only expose the specific fields the feature needs).
  // `reviews_paid_authors` returns a scalar set → data is string[] of user_ids.
  // `reviews_public_profiles` returns a table → data is array of {user_id, display_name}.
  const [paidAuthorsRes, profilesRes] = await Promise.all([
    supabase.rpc('reviews_paid_authors', { book_uuid: bookId }),
    supabase.rpc('reviews_public_profiles', { book_uuid: bookId }),
  ]);

  // Set of review-author user_ids who have a paid purchase of this book (D-RR-05).
  const paidAuthorIds = new Set<string>(paidAuthorsRes.data ?? []);
  // Public nicknames keyed by reviewer user_id (FR-RR-20).
  const publicNames = new Map<string, string | null>(
    (profilesRes.data as PublicProfileRow[] | null)?.map((p) => [p.user_id, p.display_name]) ?? [],
  );

  // Viewer's own paid status & vote statuses (own rows only → RLS-safe).
  let purchasedIds = new Set<string>();
  let votedReviewIds = new Set<string>();
  if (viewerId) {
    const [purchasesRes, votesRes] = await Promise.all([
      supabase.from('purchases').select('book_id').eq('user_id', viewerId).eq('book_id', bookId).in('status', ['paid']),
      supabase
        .from('review_votes')
        .select('review_id')
        .eq('user_id', viewerId)
        .in('review_id', rawReviews.map((r) => r.id)),
    ]);
    purchasedIds = new Set((purchasesRes.data ?? []).map((r: PurchaseBookRow) => r.book_id).filter(Boolean));
    votedReviewIds = new Set((votesRes.data ?? []).map((r: VoteReviewRow) => r.review_id).filter(Boolean));
  }

  // Vote counts per review (public read). Aggregate rows client-side to avoid
  // a per-row COUNT (N-RR-02). Empty review set → skip.
  const counts = new Map<string, number>();
  const { data: votesRows } = rawReviews.length
    ? await supabase
        .from('review_votes')
        .select('review_id')
        .in('review_id', rawReviews.map((r) => r.id))
    : { data: null as Array<{ review_id: string }> | null };
  for (const v of votesRows ?? []) {
    counts.set(v.review_id, (counts.get(v.review_id) ?? 0) + 1);
  }

  const reviews: ReviewItem[] = rawReviews.map((r) => ({
    ...r,
    // 已购 badge is the AUTHOR's paid state, not the viewer's (D-RR-05).
    display_name: publicNames.get(r.user_id) ?? null,
    purchased: paidAuthorIds.has(r.user_id),
    voted: votedReviewIds.has(r.id),
    votes: counts.get(r.id) ?? 0,
  }));

  // Total count for «查看全部 N 条».
  const { count: total } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId);

  return {
    stats,
    reviews,
    total: total ?? rawReviews.length,
    mine,
    viewerPurchased: purchasedIds.has(bookId),
  };
}
