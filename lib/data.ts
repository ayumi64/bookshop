import { createClient } from '@/lib/supabase/server';
import type { Book, BookWithPurchase, Chapter, Purchase, ReadingProgress, Profile } from '@/lib/types';
import { isTrialChapter } from '@/lib/trial';

/**
 * Server-side data access. IMPORTANT: RLS is the final defense. The viewer's
 * ability to read chapter `content` is enforced at the DB level by the
 * `chapters` RLS policy (see migrations: body only readable when purchased).
 * The application additionally avoids rendering body for non-purchasers.
 */

/** Public list of published books. */
export async function listPublicBooks(): Promise<Book[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Book[];
}

export async function getPublicBookBySlug(slug: string): Promise<Book | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Book | null) ?? null;
}

export async function getBookById(id: string): Promise<Book | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Book | null) ?? null;
}

/** Chapters for a book, ordered by sort_order. RLS gates body content. */
export async function listChapters(bookId: string): Promise<Chapter[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', bookId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Chapter[];
}

export async function getChapter(bookId: string, slug: string): Promise<Chapter | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', bookId)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Chapter | null) ?? null;
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile | null) ?? null;
}

/** Current user's purchase of a book (userId + bookId unique). */
export async function getMyPurchase(userId: string, bookId: string): Promise<Purchase | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Purchase | null) ?? null;
}

/** Current user's reading progress for a book (userId + bookId unique). */
export async function getMyProgress(userId: string, bookId: string): Promise<ReadingProgress | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ReadingProgress | null) ?? null;
}

/**
 * Books with purchase status for the current user. Used by /reader (shelf)
 * and by public pages to render "已购✓ / 试读 / 价格" badges.
 */
export async function listBooksWithPurchase(userId?: string): Promise<BookWithPurchase[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const books = (data ?? []) as Book[];

  if (!userId) return books.map((b) => ({ ...b, purchased: false }));

  const { data: purchasedRows } = await supabase
    .from('purchases')
    .select('book_id, status')
    .eq('user_id', userId);
  const purchasedMap = new Map<string, string>(
    (purchasedRows ?? []).map((r: any) => [r.book_id, r.status]),
  );
  return books.map((b) => ({
    ...b,
    purchased: purchasedMap.get(b.id) === 'paid',
    purchase_status: (purchasedMap.get(b.id) as any) ?? null,
  }));
}

/**
 * Determine body access for the reader. A non-purchased user may only see
 * trial chapters; chapter `content` is null otherwise (and RLS would also
 * deny it — this is defense-in-depth, per PRD §6 / AC-N1).
 */
export function withContentAccess(
  chapters: Chapter[],
  book: Pick<Book, 'id' | 'trial_chapters' | 'trial_percent'>,
  purchased: boolean,
): Chapter[] {
  const total = chapters.length;
  return chapters.map((c) => {
    if (purchased) return c;
    const trial = isTrialChapter(c, {
      trialChapters: book.trial_chapters,
      trialPercent: book.trial_percent,
      totalChapters: total,
    });
    return { ...c, content: trial ? c.content : null };
  });
}
