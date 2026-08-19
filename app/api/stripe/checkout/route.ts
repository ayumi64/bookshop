import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBookById } from '@/lib/data';
import { createCheckoutSession } from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * POST /api/stripe/checkout  { bookId }
 * Requires an authenticated user (AC-P1: unauthenticated requests → 401, the
 * client redirects to login preserving the intent).
 * Creates a Stripe Checkout Session and returns `{ url }` to redirect to.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  let body: { bookId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const bookId = body.bookId;
  if (!bookId) return NextResponse.json({ error: 'bookId required' }, { status: 400 });

  const book = await getBookById(bookId);
  if (!book) return NextResponse.json({ error: 'book not found' }, { status: 404 });
  if (book.status !== 'published') {
    return NextResponse.json({ error: 'book not available' }, { status: 409 });
  }

  // AC-P7: server-side duplicate-purchase guard (in addition to the UI).
  const { data: existing } = await supabase
    .from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', book.id)
    .eq('status', 'paid')
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'already purchased' }, { status: 409 });
  }

  try {
    const session = await createCheckoutSession({
      bookId: book.id,
      bookSlug: book.slug,
      bookTitle: book.title,
      amountCents: book.price_cents,
      currency: book.currency,
      userId: user.id,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'checkout creation failed';
    console.error('[checkout]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
