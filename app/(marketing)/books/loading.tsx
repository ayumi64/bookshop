import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level loading state for the storefront book list (AC-N5).
 * Replaces the data-fetching frame with skeleton placeholders so the page
 * doesn't flash/blank while SSR data loads.
 */
export default function BooksLoading() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8" aria-busy="true" aria-live="polite">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-5 w-72" />
      <div className="mb-6 mt-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <Skeleton className="h-10 sm:col-span-2" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <div className="grid grid-cols-1 gap-6 bp480:grid-cols-2 bp780:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border bg-card">
            <Skeleton className="aspect-[3/4] w-full rounded-none" />
            <div className="p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <Skeleton className="mt-4 h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
