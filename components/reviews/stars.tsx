'use client';

import { RATING_LABELS } from '@/lib/reviews-format';
import { toastStars } from '@/lib/reviews-format';
import { cn } from '@/lib/utils';

/**
 * Non-interactive star display (FR-RR-02 / A-RR-01).
 * Supports half-stars for fractional averages (0.25 → .0, 0.75 → up, else .5).
 * Uses ★/☆ characters + aria-label + the numeric text is rendered by callers.
 * Colour is never the only channel (A-RR-01).
 */
export function Stars({
  value,
  filled,
  label,
  className,
  size = 'text-base',
}: {
  /** Numeric value (may be fractional avg). */
  value: number;
  /** explicit filled-count override (full-star display only, e.g. integer ratings). */
  filled?: number;
  /** aria-label, e.g. "4 星中的 4.8". */
  label: string;
  className?: string;
  size?: string;
}) {
  // `filled` forces whole stars (integer ratings / histogram); otherwise compute
  // half-aware layout from the (possibly fractional) value.
  const { full, half, empty } =
    filled != null
      ? { full: Math.max(0, Math.min(5, filled)), half: false, empty: 5 - Math.max(0, Math.min(5, filled)) }
      : toastStars(value);

  const slots: Array<'full' | 'half' | 'empty'> = [
    ...Array<boolean>(full).fill(true).map(() => 'full' as const),
    ...(half ? ['half' as const] : []),
    ...Array<boolean>(empty).fill(true).map(() => 'empty' as const),
  ];

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex items-center leading-none', size, className)}
    >
      {slots.map((slot, i) => {
        if (slot === 'full') {
          return (
            <span key={i} aria-hidden="true" className="text-amber-500">
              ★
            </span>
          );
        }
        if (slot === 'half') {
          // Half star: filled star clipped to the left half + empty right half.
          return (
            <span key={i} aria-hidden="true" className="relative inline-block w-[0.95em]">
              <span className="absolute inset-0 text-muted-foreground/50">★</span>
              <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden text-amber-500">★</span>
            </span>
          );
        }
        return (
          <span key={i} aria-hidden="true" className="text-muted-foreground/50">
            ☆
          </span>
        );
      })}
    </span>
  );
}

/** Semantic label for a rating (5 力荐 … 1 很差, FR-RR-04/FR-RR-11). */
export function RatingLabel({ rating, className }: { rating: number; className?: string }) {
  return <span className={cn('text-muted-foreground', className)}>{RATING_LABELS[rating] ?? ''}</span>;
}
