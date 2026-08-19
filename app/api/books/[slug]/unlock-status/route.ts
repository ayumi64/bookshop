import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/books/[slug]/unlock-status
 * Returns whether the current user has purchased the book. Used by the reader
 * for webhook-fallback polling (AC-P4): when a Checkout return lands before
 * the webhook does, the client polls this endpoint for up to ~5s.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ purchased: false }, { status: 401 });

  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!book) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: purchase } = await supabase
    .from('purchases')
    .select('status')
    .eq('user_id', user.id)
    .eq('book_id', book.id)
    .eq('status', 'paid')
    .maybeSingle();

  return NextResponse.json({ purchased: !!purchase });
}
