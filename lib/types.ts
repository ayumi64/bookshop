/**
 * Shared DB types. Column aliases match the Supabase migrations in
 * supabase/migrations (see especially reading_progress / purchases RLS).
 */

export type BookStatus = 'published' | 'draft' | 'archived';

export interface Book {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  category: string | null;
  price_cents: number;
  currency: string;
  cover_url: string | null;
  body_location: string | null;
  trial_chapters: number;
  trial_percent: number;
  status: BookStatus;
  created_at: string;
  updated_at: string;
  blurb: string | null;
}

export interface Chapter {
  id: string;
  book_id: string;
  slug: string;
  title: string;
  sort_order: number;
  is_trial: boolean;
  content: string | null;
}

export type PurchaseStatus = 'pending' | 'paid' | 'refunded';

export interface Purchase {
  id: string;
  user_id: string;
  book_id: string;
  stripe_session_id: string | null;
  stripe_event_id: string | null;
  amount_cents: number;
  currency: string;
  status: PurchaseStatus;
  created_at: string;
}

export interface ReadingProgress {
  id: string;
  user_id: string;
  book_id: string;
  chapter_slug: string | null;
  paragraph_id: string | null;
  percent: number | null;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

/** `BookWithPurchase` joins a book row with the current user's purchase status. */
export interface BookWithPurchase extends Book {
  purchased: boolean;
  purchase_status?: PurchaseStatus | null;
}

// ---------------------------------------------------------------------------
// Phase 2 — Ratings & Reviews (PRD bookshop-reviews §5)
// ---------------------------------------------------------------------------

/** A single 1–5 star + optional short review (short comment). */
export interface Review {
  id: string;
  book_id: string;
  user_id: string;
  rating: number; // 1–5 int
  content: string | null; // ≤200
  declared_read: boolean;
  editor_pick: boolean; // 运营种子评分标注「编辑推荐」 (FR-RR-41)
  report_count: number;
  created_at: string;
  updated_at: string;
}

/** Aggregated stats from the `book_review_stats` aggregate table (D-RR-07). */
export interface BookReviewStats {
  book_id: string;
  avg_rating: number | null; // one decimal, null when no reviews
  review_count: number;
  r5: number;
  r4: number;
  r3: number;
  r2: number;
  r1: number;
  read_count: number;
  bought_count: number;
  updated_at: string;
}

/** A review joined with viewer identity (nickname + badges) for display. */
export interface ReviewItem extends Review {
  display_name: string | null;
  /** Server-computed: user purchased this book (purchase status=paid). (D-RR-05) */
  purchased: boolean;
  /** Whether the requesting user has voted "helpful" on this review (server-computed). */
  voted: boolean;
  /** "Helpful" vote count for this review. */
  votes: number;
}

/** Semantic label for a star rating (5 力荐 … 1 很差, PRD FR-RR-04/FR-RR-11). */
export const RATING_LABELS: Record<number, string> = {
  5: '力荐',
  4: '推荐',
  3: '还行',
  2: '较差',
  1: '很差',
};

/** Server Action result used by review client forms (inline display). */
export interface ReviewFormResult {
  ok?: boolean;
  error?: string;
  /** Preserve already-typed content across error re-render (A-RR-07). */
  submitted?: boolean;
}
