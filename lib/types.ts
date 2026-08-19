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
