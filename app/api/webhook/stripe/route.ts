import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { handleCheckoutCompleted, handleRefunded } from '@/lib/payments';

export const runtime = 'nodejs';

/**
 * Stripe webhook (PRD §5.4 / AC-P3, AC-P6, AC-P7).
 *
 * Security:
 *  - Signature verified with STRIPE_WEBHOOK_SECRET (AC-P6: forged / unsigned
 *    requests → 400, no state change).
 *  - Only `checkout.session.completed` / `charge.refunded` are handled; every
 *    other event type returns 200 with `received:true` (Stripe expects a 2xx
 *    for unhandled types).
 *  - Idempotent via event id + unique session in lib/payments (AC-P3/P7).
 */
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not configured; ignoring.');
    return NextResponse.json({ error: 'webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig ?? '', secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid signature';
    console.error('[webhook] signature verification failed:', msg);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  try {
    // Refund events arrive BEFORE checkout.session.completed in some flows or
    // after. We de-stage: resolve the payment intent to the session metadata.
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'payment') break; // subscriptions out of scope
        const userId = session.metadata?.user_id ?? session.client_reference_id ?? '';
        const bookId = session.metadata?.book_id ?? '';
        const amountCents = session.amount_total ?? 0;
        const currency = session.currency ?? 'usd';
        if (!userId || !bookId) {
          console.warn('[webhook] checkout.session.completed missing metadata', session.id);
          break;
        }
        const { created } = await handleCheckoutCompleted({
          userId,
          bookId,
          sessionId: session.id,
          eventId: event.id,
          amountCents,
          currency,
          paymentIntent:
            typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
        });
        console.log(`[webhook] ${created ? 'granted' : 'idempotent (no-op)'} purchase user=${userId} book=${bookId} session=${session.id}`);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const s = event.data.object as Stripe.Checkout.Session;
        console.warn('[webhook] async payment failed for session', s.id);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        // Follow the charge's payment_intent (that the session stored above)
        // to reconcile the matching purchase.
        const paymentIntent =
          typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.id;
        const { updated } = await handleRefunded({
          eventId: event.id,
          paymentIntent,
        });
        if (updated)
          console.log(`[webhook] refund marked purchase for charge ${charge.id}`);
        else
          console.warn('[webhook] charge.refunded with no matching purchase', charge.id);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] handler error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Stripe sends GET probes; respond health. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
