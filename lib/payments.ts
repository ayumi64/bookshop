import { createServiceClient } from '@/lib/supabase/server';

/**
 * Stripe webhook business logic (PRD §5.4 / §8.4 AC-P*).
 *
 * Uses the service-role client (bypasses RLS) because users must NOT be able
 * to flip their own purchase.status / amount (PRD §6 "用户不可改 status/amount").
 *
 * Idempotency (AC-P3 / AC-P7):
 *  - `stripe_event_id` UNIQUE → a replayed event is a no-op.
 *  - `(user_id, book_id)` UNIQUE → no double-grant of a second purchase.
 *  - `payment_intent_id` is stored so refunds can be reconciled.
 */

interface UpsertPaidParams {
  userId: string;
  bookId: string;
  sessionId: string;
  eventId: string;
  amountCents: number;
  currency: string;
  paymentIntent?: string;
}

export async function handleCheckoutCompleted(
  params: UpsertPaidParams,
): Promise<{ created: boolean }> {
  const supabase = createServiceClient();

  // 1) Event idempotency (same event replayed only once).
  const { data: existingEvent } = await supabase
    .from('purchases')
    .select('id')
    .eq('stripe_event_id', params.eventId)
    .maybeSingle();
  if (existingEvent) return { created: false };

  // 2) Already paid for user+book? Upgrade pending→paid, else grant.
  const { data: existingPaid } = await supabase
    .from('purchases')
    .select('id, status')
    .eq('user_id', params.userId)
    .eq('book_id', params.bookId)
    .maybeSingle();

  if (existingPaid) {
    if (existingPaid.status === 'paid') return { created: false };
    const { error: upErr } = await supabase
      .from('purchases')
      .update({
        status: 'paid',
        stripe_event_id: params.eventId,
        stripe_session_id: params.sessionId,
        payment_intent_id: params.paymentIntent ?? null,
        amount_cents: params.amountCents,
        currency: params.currency,
      })
      .eq('id', existingPaid.id);
    if (upErr) throw upErr;
    return { created: false };
  }

  const { error: insErr } = await supabase.from('purchases').insert({
    user_id: params.userId,
    book_id: params.bookId,
    stripe_session_id: params.sessionId,
    stripe_event_id: params.eventId,
    payment_intent_id: params.paymentIntent ?? null,
    amount_cents: params.amountCents,
    currency: params.currency,
    status: 'paid',
  });
  if (insErr) throw insErr;
  return { created: true };
}

/**
 * Basic refund handling (PRD §10 #6 "退款基础"): given a payment_intent id,
 * mark the matching paid purchase as `refunded`. Idempotent by event.
 */
export async function handleRefunded(params: {
  paymentIntent: string;
  eventId: string;
}): Promise<{ updated: boolean }> {
  const supabase = createServiceClient();

  // Avoid re-processing an already-handled refund event.
  const { data: already } = await supabase
    .from('purchases')
    .select('id')
    .eq('stripe_event_id', params.eventId)
    .eq('status', 'refunded')
    .maybeSingle();
  if (already) return { updated: false };

  const { data: row } = await supabase
    .from('purchases')
    .select('id, status')
    .eq('payment_intent_id', params.paymentIntent)
    .maybeSingle();
  if (!row) return { updated: false };

  const { error } = await supabase
    .from('purchases')
    .update({ status: 'refunded', stripe_event_id: params.eventId })
    .eq('id', row.id);
  if (error) throw error;
  return { updated: true };
}
