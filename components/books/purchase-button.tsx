'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * Purchase / unlock button (FR-P-01..02, AC-P1..P2).
 * - If not logged in → redirect to /login preserving `next=/books/[slug]?buy=1`.
 *   The login page sends the user back, then checkout can be triggered.
 * - If logged in → create the Stripe Checkout session and redirect.
 *
 * `autoTrigger` (AC-P1 flow continuity): when `true`, on mount the button
 * reads `?buy=<bookId>` from the URL. If it matches this button's `bookId`
 * (set as the login-return intent `next=/books/[slug]?buy=[id]`), it
 * automatically triggers Checkout so the user lands directly in the pay
 * flow after coming back from login, without having to click unlock again.
 */
export function PurchaseButton({
  bookId,
  bookSlug,
  isLoggedIn,
  label,
  size,
  variant = 'default',
  className,
  autoTrigger = false,
}: {
  bookId: string;
  bookSlug: string;
  isLoggedIn: boolean;
  label: string;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
  autoTrigger?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoFiredRef = useRef(false);

  async function handleClick() {
    if (!isLoggedIn) {
      // Preserve intent: after login return here with ?buy=1 so the page can authorize checkout.
      router.push(`/login?next=${encodeURIComponent(`/books/${bookSlug}?buy=${bookId}`)}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/books/${bookSlug}?buy=${bookId}`)}`);
          return;
        }
        throw new Error(json.error || 'checkout failed');
      }
      if (json.url) router.push(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法发起购买，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }

  // AC-P1 login-return continuity: auto-continue to Checkout when the URL
  // carries the buy intent for this book (e.g. `?buy=<bookId>` set by
  // `next=/books/[slug]?buy=[id]` before going to /login).
  useEffect(() => {
    if (!autoTrigger || autoFiredRef.current || typeof window === 'undefined') return;
    const buy = new URLSearchParams(window.location.search).get('buy');
    if (!buy || buy !== bookId) return;
    if (!isLoggedIn) {
      // Shouldn't normally happen (login redirects here), but keep intent.
      router.push(`/login?next=${encodeURIComponent(`/books/${bookSlug}?buy=${bookId}`)}`);
      return;
    }
    autoFiredRef.current = true;
    void handleClick();
    // Run once on mount only. handleClick is intentionally stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={handleClick} disabled={loading} variant={variant} size={size} className={className}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
