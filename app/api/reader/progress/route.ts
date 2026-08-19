import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/reader/progress
 * { bookId, chapterSlug, paragraphId, percent }
 * Saves reading progress (RLS: only the owner can write). Debounced client-side
 * (800ms). Offline progress is buffered locally and synced on reconnect by the
 * client (AC-R8). Returns the saved row id.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'authentication required' }, { status: 401 });

  let body: { bookId?: string; chapterSlug?: string; paragraphId?: string | null; percent?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { bookId, chapterSlug, paragraphId = null, percent = 0 } = body;
  if (!bookId || !chapterSlug) {
    return NextResponse.json({ error: 'bookId and chapterSlug required' }, { status: 400 });
  }

  const clampedPercent = Math.max(0, Math.min(100, Number(percent) || 0));

  // Upsert on (user_id, book_id).
  const { data: existing } = await supabase
    .from('reading_progress')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('reading_progress')
      .update({ chapter_slug: chapterSlug, paragraph_id: paragraphId, percent: clampedPercent })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from('reading_progress').insert({
      user_id: user.id,
      book_id: bookId,
      chapter_slug: chapterSlug,
      paragraph_id: paragraphId,
      percent: clampedPercent,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
