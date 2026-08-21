/**
 * Pure display helpers for ratings & reviews (FR-RR-02 / FR-RR-04 etc).
 *
 * This module has NO server-only / supabase imports, so it is safe to import
 * from BOTH Server Components/Actions AND Client Components. Client components
 * (e.g. `components/reviews/book-reviews.tsx`) must import their formatting
 * helpers from here — NOT from `lib/reviews.ts` (which pulls `next/headers`
 * through `lib/supabase/server.ts` and would break the client bundle, P1-1).
 */

/** Integer semantic labels used by client + server. */
export const RATING_LABELS: Record<number, string> = {
  5: '力荐', 4: '推荐', 3: '还行', 2: '较差', 1: '很差',
};

/** Round avg to one decimal for display (avg_rating already numeric(3,1)). */
export function formatAvg(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(1);
}

/** Human-readable count (1,024 人评价). */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * Resolve a fractional average into a half-star-aware structure used by the
 * visual `<Stars>` component (FR-RR-02). Rounding threshold: 0.25 → .0,
 * 0.75 → up to next whole; 0.25–0.749 renders a half star.
 */
export function toastStars(avg: number | null | undefined, max = 5): {
  full: number;
  half: boolean;
  empty: number;
} {
  if (avg == null) return { full: 0, half: false, empty: max };
  const raw = Math.max(0, Math.min(max, avg));
  const whole = Math.floor(raw);
  const frac = raw - whole;
  if (frac >= 0.75) return { full: Math.min(max, whole + 1), half: false, empty: Math.max(0, max - (whole + 1)) };
  if (frac >= 0.25) return { full: whole, half: true, empty: Math.max(0, max - whole - 1) };
  return { full: whole, half: false, empty: max - whole };
}

/**
 * Plain-text star string for non-visual contexts / server-side tests.
 * `★`=full, `⯨`=half, `☆`=empty (numbers stay the accessible truth).
 */
export function starsFor(avg: number | null | undefined, max = 5): string {
  const { full, half, empty } = toastStars(avg, max);
  return '★'.repeat(full) + (half ? '⯨' : '') + '☆'.repeat(empty);
}
