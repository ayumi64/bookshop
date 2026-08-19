import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level loading state for the reading view (AC-R2 / AC-N5).
 * Shows a slim reader frame (top bar + prose block) while chapters load.
 */
export default function ReaderLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-3/4" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" style={i % 3 === 0 ? { width: '91%' } : i % 3 === 1 ? { width: '96%' } : undefined} />
        ))}
      </div>
    </div>
  );
}
