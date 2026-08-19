import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  listChapters,
  getMyPurchase,
  getMyProgress,
  withContentAccess,
} from '@/lib/data';
import { Reader } from '@/components/reader/reader';
import type { Book, Chapter } from '@/lib/types';

export const metadata: Metadata = { title: '阅读器' };

/**
 * Reader server page (PRD §4.1 / §5.5 / §8.5 AC-R*).
 *
 * Middleware already protects /reader → redirects unauthenticated users to
 * login, so by the time this renders the user is authenticated.
 *
 * It loads:
 *  - the book by slug (any status, so an already-purchased user can reopen an
 *    unpublished/archived book; non-purchasers get 404 unless it's published)
 *  - the chapters (RLS gates `content`: only trial chapters visible to a
 *    non-purchaser, full body only on a paid purchase — PRD §6 / AC-N1)
 *  - the current user's paid purchase status
 *  - the current user's reading progress (last chapter + paragraph anchor +
 *    percent) so the reader can restore position (AC-R4)
 *
 * `withContentAccess` additionally nulls out `content` for non-purchasers on
 * non-trial chapters (defense-in-depth — the DB already enforces it via RLS).
 */
export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { user } = await getCurrentUser();
  const isLoggedIn = !!user;

  // Load the book by slug regardless of status so that an already-purchased
  // user can still open it after it's unpublished (AC-M3 / AC-B3). A
  // non-purchaser may only open the reader for a currently published book.
  const supabase = createClient();
  const { data: bookRow } = await supabase
    .from('books')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle();
  const book = (bookRow as Book | null) ?? null;
  if (!book) notFound();

  const purchase = user ? await getMyPurchase(user.id, book.id) : null;
  const purchased = purchase?.status === 'paid';

  // Unpublished / archived without a paid purchase → not reachable (404).
  if (book.status !== 'published' && !purchased) notFound();

  const chapters = await listChapters(book.id);
  const totalChapters = chapters.length;

  // Apply content access: body private per purchase (PRD §6, §8.5 AC-R1).
  const accessChapters: Chapter[] = withContentAccess(chapters, book, purchased);

  // Reading progress (AC-R4): restore last chapter + paragraph anchor + percent.
  const progress = user ? await getMyProgress(user.id, book.id) : null;

  // ?trial=1 preserves the "试读第一章" intent from the details page. When set,
  // the reader enters the first trial chapter regardless of any saved progress.
  const trialOverride = searchParams.trial === '1';

  // Determine entry chapter for the reader. Prefer the saved progress unless
  // we're in trial-override mode; the client falls back to the first readable
  // chapter if none match.
  const initialChapterSlug = trialOverride ? null : progress?.chapter_slug ?? null;
  const initialParagraphId = trialOverride ? null : progress?.paragraph_id ?? null;
  const initialPercent = trialOverride ? null : progress?.percent ?? null;

  return (
    <Reader
      book={book}
      chapters={accessChapters}
      purchased={purchased}
      totalChapters={totalChapters}
      initialChapterSlug={initialChapterSlug}
      initialParagraphId={initialParagraphId}
      initialPercent={initialPercent}
      isLoggedIn={isLoggedIn}
      trialOverride={trialOverride || undefined}
    />
  );
}
