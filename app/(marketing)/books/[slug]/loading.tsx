import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level loading state for the book detail page (AC-N5).
 */
export default function BookDetailLoading() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-24" />
      <div className="mt-4 grid gap-8 md:grid-cols-[260px_1fr]">
        <div>
          <Skeleton className="aspect-[3/4] w-full max-w-[260px] rounded-lg" />
        </div>
        <div>
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="mt-3 h-5 w-40" />
          <Skeleton className="mt-4 h-16 w-full" />
          <div className="mt-8 flex gap-3">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
      </div>
      <div className="mt-10">
        <Skeleton className="h-6 w-32" />
        <div className="mt-3 divide-y rounded-lg border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
