import Stripe from 'stripe';
import { CHECKOUT, CURRENCY, SITE } from '@/lib/config';

let _stripe: Stripe | null = null;

/** Lazily-initialised Stripe client (server only). */
export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key, { apiVersion: '2024-06-20' });
  }
  return _stripe;
}

export function publishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_SECRET_KEY || '';
}

/**
 * Create a Checkout Session for a single book (PRD §5.4 / AC-P1..P2).
 * - `success_url` → /reader/[slug] (the reader already polls for the webhook).
 * - `cancel_url`  → /books/[slug] (AC-P5: cancel returns to details, no purchase).
 * - `metadata.book_id` carries the book id so the webhook can resolve it.
 */
export async function createCheckoutSession(params: {
  bookId: string;
  bookSlug: string;
  bookTitle: string;
  amountCents: number;
  currency?: string;
  userId: string;
}): Promise<Stripe.Checkout.Session> {
  const { bookId, bookSlug, bookTitle, amountCents, userId } = params;
  const currency = params.currency || CURRENCY;

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: bookTitle },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    client_reference_id: userId,
    metadata: { book_id: bookId, user_id: userId, book_slug: bookSlug },
    success_url: `${SITE.url}${CHECKOUT.successPath(bookSlug)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE.url}${CHECKOUT.cancelPath(bookSlug)}`,
  });
  return session;
}
