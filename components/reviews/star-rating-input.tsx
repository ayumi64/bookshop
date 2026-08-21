'use client';

import { useRef, useState } from 'react';
import { RATING_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RatingLabel } from './stars';

/**
 * Keyboard + hover star input (FR-RR-11 / A-RR-04 / A-RR-01).
 * - 1–5 integer stars
 * - arrow keys select, Enter confirms selection (component commits on focus loss)
 * - hover/focus previews the star + semantic label
 * - error text ties via aria-describedby (A-RR-07)
 */
export function StarRatingInput({
  name,
  value,
  onChange,
  errorId,
  describedBy,
}: {
  name: string;
  /** currently selected rating (0 = none). */
  value: number;
  onChange: (v: number) => void;
  errorId?: string;
  describedBy?: string;
}) {
  const [hover, setHover] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const shown = hover || value; // preview on hover/focus, else current
  const label = shown ? `${shown} 星：${RATING_LABELS[shown] ?? ''}` : '未选择星级，用方向键选择';

  function focusStar(n: number) {
    setHover(n);
  }

  function commit(n: number) {
    onChange(n);
  }

  return (
    <div>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="你的评分（1–5 星）"
        aria-describedby={describedBy || undefined}
        className="flex items-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} 星：${RATING_LABELS[n] ?? ''}`}
            aria-describedby={errorId || undefined}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => focusStar(n)}
            onBlur={() => setHover(0)}
            onClick={() => commit(n)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const dir = e.key === 'ArrowLeft' ? -1 : 1;
                const next = Math.max(1, Math.min(5, n + dir));
                commit(next);
                setHover(next);
                // focus the newly selected button
                const btns = containerRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
                btns?.[next - 1]?.focus();
              }
            }}
            className={cn(
              'text-2xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm transition-colors',
              'cursor-pointer',
            )}
          >
            <span
              aria-hidden="true"
              className={shown >= n ? 'text-amber-500' : 'text-muted-foreground/50'}
            >
              ★
            </span>
          </button>
        ))}
      </div>
      {/* semantic label follows hover/selection (FR-RR-11) */}
      <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
        {label}
        {value > 0 && <span className="ml-1">已选 {value} 星</span>}
      </p>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

/** Display a read-only preview with a semantic tagline for the summary. */
export function StarRatingSummaryText({ value }: { value: number }) {
  return (
    <span className="text-sm text-muted-foreground">
      平均 {RATING_LABELS[Math.round(value)] ?? ''}
    </span>
  );
}
